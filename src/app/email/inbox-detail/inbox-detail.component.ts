import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {InboxMessage, InboxService} from '../inbox.service';
import {DatePipe, NgIf} from '@angular/common';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

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
    private sanitizer: DomSanitizer
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Nie wybrano wiadomości';
      this.loading = false;
      return;
    }

    // Oznacz jako odczytane, potem pobierz treść
    this.inbox.markRead(id).subscribe({
      next: () => {
      }, error: () => {
      }
    });

    this.inbox.getMessage(id).subscribe({
      next: m => {
        this.msg = m;
        this.bodyHtml = this.renderBody(m);
        this.loading = false;
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

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
