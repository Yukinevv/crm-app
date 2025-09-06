import {Component, OnInit} from '@angular/core';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {Router, RouterLink} from '@angular/router';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {InboxItem, InboxQuery, InboxService} from '../inbox.service';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {debounceTime} from 'rxjs/operators';
import {ImapConfigView, ImapSettingsService} from '../imap-settings.service';

type Tab = 'inbox' | 'sent';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  imports: [
    NgIf,
    NgForOf,
    DatePipe,
    RouterLink,
    ReactiveFormsModule
  ],
  styleUrls: ['./email-list.component.scss'],
  standalone: true
})
export class EmailListComponent implements OnInit {
  // Tabs
  active: Tab = 'inbox';

  // INBOX (cache + widok)
  // Pełny zestaw ostatnio pobranych wiadomości z IMAP (cache w komponencie)
  private inboxAll: InboxItem[] = [];
  // Filtrowana lista wyświetlana w tabeli
  inbox: InboxItem[] = [];

  inboxLoading = false;
  inboxError: string | null = null;

  // INBOX filters (client-side)
  inboxForm: FormGroup;

  // SENT
  emails: Email[] = [];
  sentLoading = false;
  sentError: string | null = null;

  // IMAP state
  imapConfigured: boolean | null = null; // null = nie sprawdzone, true = ok, false = brak

  // Czy po starcie widoku pobraliśmy już IMAP (po zalogowaniu)
  private inboxLoadedOnce = false;

  constructor(
    private emailService: EmailService,
    private inboxService: InboxService,
    private router: Router,
    private fb: FormBuilder,
    private imapSettings: ImapSettingsService
  ) {
    this.inboxForm = this.fb.group({
      q: [''],
      from: [''],
      subject: [''],
      dateFrom: [''],
      dateTo: [''],
      unread: [false]
    });
  }

  ngOnInit(): void {
    if (this.active === 'inbox') {
      this.checkImapConfigured();
      this.loadInbox(false);
    } else {
      this.loadSent();
    }

    // Debounce filtrów - tylko lokalne filtrowanie, bez requestów do IMAP
    this.inboxForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(() => {
        if (this.active === 'inbox') this.applyInboxFilters();
      });
  }

  setTab(tab: Tab): void {
    this.active = tab;
    if (tab === 'inbox') {
      this.checkImapConfigured();
      // Nie odświeżaj IMAP przy każdym wejściu - tylko pierwsze wejście albo ręczne "Odśwież"
      if (!this.inboxLoadedOnce && !this.inboxLoading) {
        this.loadInbox(false);
      } else {
        // już mamy cache - tylko prze-filtruj pod bieżące filtry
        this.applyInboxFilters();
      }
    } else if (tab === 'sent' && this.emails.length === 0 && !this.sentLoading) {
      this.loadSent();
    }
  }

  resetInboxFilters(): void {
    this.inboxForm.reset({
      q: '',
      from: '',
      subject: '',
      dateFrom: '',
      dateTo: '',
      unread: false
    }, {emitEvent: true});
  }

  // ----- INBOX -----

  /** Buduje obiekt filtrów (na potrzeby local filter) */
  private readFilters(): InboxQuery {
    const f = this.inboxForm.value;
    return {
      limit: 200,
      q: f.q?.trim() || undefined,
      from: f.from?.trim() || undefined,
      subject: f.subject?.trim() || undefined,
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      unread: !!f.unread
    };
  }

  loadInbox(force: boolean): void {
    if (!force && this.inboxLoadedOnce) {
      // mamy cache - nie pobieramy ponownie
      this.applyInboxFilters();
      return;
    }

    this.inboxLoading = true;
    this.inboxError = null;

    this.inboxService.list({limit: this.readFilters().limit}).subscribe({
      next: items => {
        this.inboxAll = items || [];
        this.inboxLoadedOnce = true;
        this.applyInboxFilters();
        this.inboxLoading = false;
      },
      error: () => {
        this.inboxError = 'Błąd ładowania odebranych';
        this.inboxLoading = false;
      }
    });
  }

  /** Lokalna filtracja + sort (malejąco po dacie) na podstawie inboxAll */
  private applyInboxFilters(): void {
    const f = this.readFilters();
    const norm = (s: any) => String(s || '').toLowerCase();

    let filtered = this.inboxAll.slice();

    if (f.q) {
      const ql = f.q.toLowerCase();
      filtered = filtered.filter(m => {
        const bucket = `${m.from} ${m.to} ${m.subject} ${m.preview || ''}`.toLowerCase();
        return bucket.includes(ql);
      });
    }
    if (f.from) filtered = filtered.filter(m => norm(m.from).includes(norm(f.from)));
    if (f.subject) filtered = filtered.filter(m => norm(m.subject).includes(norm(f.subject)));

    if (f.dateFrom) {
      const df = new Date(f.dateFrom);
      filtered = filtered.filter(m => new Date(m.date) >= df);
    }
    if (f.dateTo) {
      const dt = new Date(f.dateTo);
      dt.setHours(23, 59, 59, 999);
      filtered = filtered.filter(m => new Date(m.date) <= dt);
    }

    if (f.unread) filtered = filtered.filter(m => !m.isRead);

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.inbox = filtered;
  }

  /** Ręczne odświeżenie - wymusza ponowne pobranie z IMAP i aktualizację cache */
  refreshInbox(): void {
    if (this.inboxLoading) return;
    this.loadInbox(true);
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

  private checkImapConfigured(): void {
    this.imapSettings.get().subscribe({
      next: (cfg: ImapConfigView | null) => {
        // Uznajemy za skonfigurowane, jeśli są host, user i zapisane hasło
        this.imapConfigured = !!(cfg && cfg.host && cfg.user && cfg.hasPassword);
      },
      error: () => {
        this.imapConfigured = false;
      }
    });
  }
}
