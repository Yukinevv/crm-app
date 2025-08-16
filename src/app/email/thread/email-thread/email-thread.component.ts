import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {DatePipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {Subscription, switchMap} from 'rxjs';
import {Conversation} from '../../conversations/conversations.model';
import {Email} from '../../email.model';
import {ConversationService} from '../../conversations/conversations.service';
import {EmailService} from '../../email.service';
import {ContactService} from '../../../contacts/contact.service';

@Component({
  selector: 'app-email-thread',
  standalone: true,
  imports: [NgIf, NgForOf, NgClass, DatePipe],
  templateUrl: './email-thread.component.html',
  styleUrls: ['./email-thread.component.scss']
})
export class EmailThreadComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;

  // parametry wątku
  contactId?: string | null;
  leadId?: string | null;
  counterpartEmail?: string | null;

  // dane
  items: Conversation[] = [];
  expanded = new Set<string>(); // emailId -> expanded
  emailCache = new Map<string, Email>(); // emailId -> Email
  title = 'Wątek korespondencji';

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conv: ConversationService,
    private emails: EmailService,
    private contacts: ContactService
  ) {
  }

  ngOnInit(): void {
    const sub = this.route.queryParamMap
      .pipe(
        switchMap(qp => {
          this.loading = true;
          this.error = null;

          this.contactId = qp.get('contactId');
          this.leadId = qp.get('leadId');
          this.counterpartEmail = qp.get('email');

          // Ustal tytuł (jeśli mamy kontakt)
          if (this.contactId) {
            this.contacts.getById(this.contactId).subscribe({
              next: c => {
                this.title = `Wątek: ${c.firstName} ${c.lastName} ${c.email ? '– ' + c.email : ''}`;
              },
              error: () => {
                this.title = 'Wątek korespondencji';
              }
            });
          } else if (this.counterpartEmail) {
            this.title = `Wątek: ${this.counterpartEmail}`;
          } else {
            this.title = 'Wątek korespondencji';
          }

          return this.conv.list({
            contactId: this.contactId || undefined,
            leadId: this.leadId || undefined,
            counterpartEmail: this.counterpartEmail || undefined,
            limit: 1000
          });
        })
      )
      .subscribe({
        next: list => {
          // rosnąco po dacie (od najstarszej do najnowszej)
          this.items = [...list].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          this.loading = false;
        },
        error: () => {
          this.error = 'Nie udało się pobrać wątku';
          this.loading = false;
        }
      });

    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  isExpanded(emailId: string): boolean {
    return this.expanded.has(emailId);
  }

  toggle(item: Conversation): void {
    if (!item.emailId) return;
    if (this.expanded.has(item.emailId)) {
      this.expanded.delete(item.emailId);
      return;
    }

    // rozwiń – jeśli nie mamy w cache, pobierz
    if (!this.emailCache.has(item.emailId)) {
      this.emails.getEmail(item.emailId).subscribe({
        next: e => {
          this.emailCache.set(item.emailId, e);
          this.expanded.add(item.emailId);
        },
        error: () => {
          // jak nie ma pełnej treści, pokażemy tylko preview i metadane
          this.expanded.add(item.emailId);
        }
      });
    } else {
      this.expanded.add(item.emailId);
    }
  }

  getEmailBody(item: Conversation): string {
    const e = item.emailId ? this.emailCache.get(item.emailId) : null;
    return e?.body || item.preview || '';
  }

  back(): void {
    this.router.navigate(['/email/conversations']);
  }
}
