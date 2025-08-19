import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {InboxMessage, InboxService} from '../inbox.service';
import {DatePipe, NgIf} from '@angular/common';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ConversationService} from '../conversations/conversations.service';
import {AuthService} from '../../auth/auth.service';
import {take} from 'rxjs';

@Component({
  selector: 'app-inbox-detail',
  templateUrl: './inbox-detail.component.html',
  styleUrls: ['./inbox-detail.component.scss'],
  imports: [NgIf, DatePipe],
  standalone: true
})
export class InboxDetailComponent implements OnInit {
  msg?: InboxMessage;
  loading = true;
  error: string | null = null;
  bodyHtml: SafeHtml | null = null;

  constructor(
    private route: ActivatedRoute,
    private inbox: InboxService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private conv: ConversationService,
    private auth: AuthService
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Nie wybrano wiadomości';
      this.loading = false;
      return;
    }

    // best-effort markRead
    this.inbox.markRead(id).subscribe({
      next: () => {
      }, error: () => {
      }
    });

    // pobierz treść
    this.inbox.getMessage(id).subscribe({
      next: m => {
        this.msg = m;
        this.bodyHtml = this.renderBody(m);
        this.loading = false;

        // === AUTO-LOG “IN” ===
        const counterpart = this.extractEmail(m.from);
        const plain = m.bodyText || (m.bodyHtml ? this.stripHtml(m.bodyHtml) : '');
        this.conv.logEmailAutoLink({
          userId: '', // zostanie wypełniony w serwisie z Auth
          direction: 'in',
          subject: m.subject || '(bez tematu)',
          body: plain || '',
          date: m.date,
          emailId: m.id, // ważne do idempotencji
          counterpartEmail: counterpart
        }).subscribe({
          next: () => {
          }, error: () => {
          }
        });
      },
      error: () => {
        this.error = 'Nie można wczytać wiadomości';
        this.loading = false;
      }
    });
  }

  back(): void {
    this.router.navigate(['/email']);
  }

  reply(): void {
    // Przejście do compose z wstępnie uzupełnionymi polami
    const to = this.msg ? this.extractEmail(this.msg.from) : '';
    const subject = this.msg?.subject?.toLowerCase().startsWith('re:') ? this.msg.subject : `Re: ${this.msg?.subject || ''}`;
    const quoted = this.buildQuoted();

    this.router.navigate(['/email/compose'], {
      queryParams: {
        to,
        subject,
        body: quoted
      }
    });
  }

  importThread(): void {
    // prosta heurystyka: ten sam znormalizowany temat + ten sam rozmówca
    if (!this.msg) return;
    const current = this.msg;
    const normSubj = this.normalizeSubject(current.subject);
    const counterpart = this.extractEmail(current.from);

    // pobierz ostatnie N wiadomości z inboxu i próbuj dopasować
    this.auth.user$.pipe(take(1)).subscribe(user => {
      const myEmail = user?.email?.toLowerCase() || '';

      this.inbox.list({limit: 300}).subscribe({
        next: items => {
          const candidates = items.filter(it => {
            const s = this.normalizeSubject(it.subject || '');
            const from = this.extractEmail(it.from);
            const to = this.extractEmail(it.to || '');
            const sameSubj = s === normSubj;
            const sameCounterpart = from === counterpart || to === counterpart;
            return sameSubj && sameCounterpart;
          });

          // zaloguj każdy z kandydatów (idempotencja po emailId nas chroni)
          const ops = candidates.map(it => {
            const direction = this.extractEmail(it.from) === myEmail ? 'out' : 'in';
            return this.conv.logEmailAutoLink({
              userId: '',
              direction: direction as 'in' | 'out',
              subject: it.subject || '(bez tematu)',
              body: it.preview || '',
              date: it.date,
              emailId: it.id,
              counterpartEmail: direction === 'in' ? this.extractEmail(it.from) : this.extractEmail(it.to)
            });
          });

          // uruchom wszystkie, nie blokujemy UI
          ops.forEach(o => o.subscribe({
            next: () => {
            }, error: () => {
            }
          }));
          alert(`Zaimportowano ${candidates.length} wiadomości do konwersacji`);
        },
        error: () => alert('Nie udało się pobrać listy wiadomości do importu')
      });
    });
  }

  // ===== render / utils =====

  private renderBody(m: InboxMessage): SafeHtml {
    if (m.bodyHtml) {
      return this.sanitizer.bypassSecurityTrustHtml(m.bodyHtml);
    }
    const safe = this.escapeHtml(m.bodyText || '');
    const linkified = safe.replace(/\bhttps?:\/\/[^\s<>"']+/gi, (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
    const withBreaks = linkified.replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(withBreaks);
  }

  private stripHtml(html: string): string {
    return html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private buildQuoted(): string {
    const header = this.msg
      ? `\n\n--- Oryginalna wiadomość ---\nOd: ${this.msg.from}\nDo: ${this.msg.to}\nData: ${new Date(this.msg.date)
        .toLocaleString('pl-PL')}\nTemat: ${this.msg.subject}\n\n`
      : '\n\n--- Oryginalna wiadomość ---\n\n';
    const body = this.msg?.bodyText || (this.msg?.bodyHtml ? this.stripHtml(this.msg.bodyHtml) : '');
    return header + (body || '');
  }

  private extractEmail(s: string | null | undefined): string {
    const str = String(s || '').trim();
    const m = str.match(/<([^>]+)>/);
    const raw = m ? m[1] : str;
    return raw.replace(/^[^@]*mailto:/i, '').trim().toLowerCase();
  }

  private normalizeSubject(s: string): string {
    return String(s || '')
      .replace(/^\s*(re|fw|fwd)\s*:\s*/gi, '')
      .trim()
      .toLowerCase();
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
