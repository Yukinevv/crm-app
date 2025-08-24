import {Component} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {NgClass, NgForOf, NgIf} from '@angular/common';
import {firstValueFrom, take} from 'rxjs';

import {Contact} from '../../contacts/contact.model';
import {ContactService} from '../../contacts/contact.service';
import {AuthService} from '../../auth/auth.service';
import {EmailService} from '../email.service';
import {RouterLink} from '@angular/router';

type RowStatus = 'pending' | 'sending' | 'sent' | 'error';

interface Row {
  id: string;
  name: string;
  email: string;
  status: RowStatus;
  error?: string | null;
}

@Component({
  selector: 'app-email-bulk',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, NgIf, NgForOf, NgClass, RouterLink],
  templateUrl: './email-bulk.component.html',
  styleUrls: ['./email-bulk.component.scss']
})
export class EmailBulkComponent {
  form: FormGroup;

  contacts: Contact[] = [];
  filtered: Contact[] = [];

  // UI / state
  search = '';
  selectedIds = new Set<string>();
  rows: Row[] = [];

  sending = false;
  cancelRequested = false;
  progress = 0; // 0..1
  summary = {total: 0, ok: 0, fail: 0};

  // Tekst do placeholdera przeniesiony tu, aby nie triggerować interpolacji w HTML
  public readonly placeholderHint =
    'Możesz używać zmiennych: {{firstName}}, {{lastName}}, {{company}}, {{email}}, {{position}}';

  constructor(
    private fb: FormBuilder,
    private contactsService: ContactService,
    private auth: AuthService,
    private emailService: EmailService
  ) {
    this.form = this.fb.group({
      subject: ['', Validators.required],
      body: ['', Validators.required],
      trackLinks: [true]
    });
  }

  ngOnInit(): void {
    // korzysta z cache ContactService
    this.contactsService.getAll().pipe(take(1)).subscribe(list => {
      this.contacts = list || [];
      this.applyFilter();
    });
  }

  // ======= wybór kontaktów =======
  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q
      ? this.contacts.slice()
      : this.contacts.filter(c => {
        const bucket = `${c.firstName} ${c.lastName} ${c.company} ${c.email}`.toLowerCase();
        return bucket.includes(q);
      });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggle(id: string, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
  }

  selectAllVisible(): void {
    this.filtered.forEach(c => this.selectedIds.add(c.id));
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  get selectedContacts(): Contact[] {
    const ids = this.selectedIds;
    return this.contacts.filter(c => ids.has(c.id));
  }

  // ======= wysyłka =======
  async startSend(): Promise<void> {
    if (this.form.invalid || this.selectedIds.size === 0 || this.sending) return;

    this.sending = true;
    this.cancelRequested = false;
    this.progress = 0;
    this.summary = {total: this.selectedIds.size, ok: 0, fail: 0};

    // wiersze statusów
    this.rows = this.selectedContacts.map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim() || c.email,
      email: c.email,
      status: 'pending' as RowStatus,
      error: null
    }));

    const {subject, body, trackLinks} = this.form.value;
    const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
    const fromEmail = user?.email ?? '';

    let done = 0;

    for (const row of this.rows) {
      if (this.cancelRequested) break;
      row.status = 'sending';

      const contact = this.contacts.find(c => c.id === row.id)!;
      const subj = this.interpolate(subject, contact);
      const bod = this.interpolate(body, contact);

      try {
        await firstValueFrom(
          this.emailService.sendEmail(
            {
              from: fromEmail,
              to: row.email,
              subject: subj,
              body: bod,
              trackLinks: !!trackLinks
            },
            {contactId: contact.id} // trafia do logów konwersacji
          )
        );
        row.status = 'sent';
        this.summary.ok++;
      } catch (e: any) {
        row.status = 'error';
        row.error = e?.message || 'Błąd wysyłki';
        this.summary.fail++;
      } finally {
        done++;
        this.progress = done / this.summary.total;
        // delikatny throttle, by nie zarzynać SMTP
        await this.sleep(120);
      }
    }

    this.sending = false;
  }

  cancel(): void {
    this.cancelRequested = true;
  }

  reset(): void {
    if (this.sending) return;
    this.rows = [];
    this.progress = 0;
    this.summary = {total: 0, ok: 0, fail: 0};
  }

  // ======= utils =======
  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }

  /** Prosta interpolacja {{firstName}}, {{lastName}}, {{company}}, {{email}}, {{position}} */
  private interpolate(text: string, c: Contact): string {
    const map: Record<string, string | undefined> = {
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      email: c.email,
      position: c.position
    };
    return String(text).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k: string) => {
      const v = map[k] ?? '';
      return v == null ? '' : String(v);
    });
  }
}
