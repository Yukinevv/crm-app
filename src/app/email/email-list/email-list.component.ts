import {Component, OnInit} from '@angular/core';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {Router, RouterLink} from '@angular/router';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {InboxItem, InboxService} from '../inbox.service';

type Tab = 'inbox' | 'sent';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  imports: [
    NgIf,
    NgForOf,
    DatePipe,
    RouterLink
  ],
  styleUrls: ['./email-list.component.scss'],
  standalone: true
})
export class EmailListComponent implements OnInit {
  // Tabs
  active: Tab = 'inbox';

  // INBOX
  inbox: InboxItem[] = [];
  inboxLoading = false;
  inboxError: string | null = null;

  // SENT
  emails: Email[] = [];
  sentLoading = false;
  sentError: string | null = null;

  constructor(
    private emailService: EmailService,
    private inboxService: InboxService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    // domyślnie ładujemy Odebrane
    this.loadInbox();
  }

  setTab(tab: Tab): void {
    this.active = tab;
    if (tab === 'inbox' && this.inbox.length === 0 && !this.inboxLoading) {
      this.loadInbox();
    } else if (tab === 'sent' && this.emails.length === 0 && !this.sentLoading) {
      this.loadSent();
    }
  }

  // ----- INBOX -----
  loadInbox(): void {
    this.inboxLoading = true;
    this.inboxError = null;
    this.inboxService.list(100).subscribe({
      next: items => {
        this.inbox = items;
        this.inboxLoading = false;
      },
      error: () => {
        this.inboxError = 'Błąd ładowania odebranych';
        this.inboxLoading = false;
      }
    });
  }

  openInbox(m: InboxItem): void {
    this.router.navigate(['/email/inbox', m.id]);
  }

  // ----- SENT -----
  loadSent(): void {
    this.sentLoading = true;
    this.sentError = null;
    this.emailService.getEmails().subscribe({
      next: data => {
        this.emails = data.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        this.sentLoading = false;
      },
      error: () => {
        this.sentError = 'Błąd ładowania wysłanych';
        this.sentLoading = false;
      }
    });
  }

  openEmail(email: Email): void {
    this.emailService.markAsRead(email.id).subscribe(() => {
      this.router.navigate(['/email/read', email.id]);
    });
  }

  compose(): void {
    this.router.navigate(['/email/compose']);
  }
}
