import {Component, OnInit} from '@angular/core';
import {DatePipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';

import {take} from 'rxjs';
import {Conversation} from '../conversations.model';
import {Contact} from '../../../contacts/contact.model';
import {ConversationService} from '../conversations.service';
import {ContactService} from '../../../contacts/contact.service';
import {AuthService} from '../../../auth/auth.service';

@Component({
  selector: 'app-email-conversations',
  standalone: true,
  imports: [NgIf, NgForOf, DatePipe, FormsModule, RouterLink, NgClass],
  templateUrl: './email-conversations.component.html',
  styleUrls: ['./email-conversations.component.scss']
})
export class EmailConversationsComponent implements OnInit {
  loading = true;
  error: string | null = null;

  q = '';
  conversations: Conversation[] = [];
  contacts: Contact[] = [];

  // mapy ID -> nazwa
  contactName = new Map<string, string>();
  leadName = new Map<string, string>();

  // proste filtrowanie po liście (poza backendowym `q`)
  filterDirection: 'all' | 'out' | 'in' = 'all';

  constructor(
    private conv: ConversationService,
    private contactsService: ContactService,
    private auth: AuthService
  ) {
  }

  ngOnInit(): void {
    // pobierz kontakty użytkownika (do nazw)
    this.contactsService.getAll().pipe(take(1)).subscribe(list => {
      this.contacts = list || [];
      this.contacts.forEach(c => {
        this.contactName.set(c.id, `${c.firstName} ${c.lastName}`.trim());
      });
    });

    this.load();
  }

  load(): void {
    this.loading = true;
    this.conv.list({q: this.q, limit: 500}).subscribe({
      next: items => {
        this.conversations = items;
        this.loading = false;
      },
      error: () => {
        this.error = 'Nie udało się pobrać logów';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.load();
  }

  get filtered(): Conversation[] {
    if (this.filterDirection === 'all') return this.conversations;
    return this.conversations.filter(c => c.direction === this.filterDirection);
  }

  nameFor(c: Conversation): string {
    if (c.contactId) return this.contactName.get(c.contactId) || '(kontakt)';
    if (c.leadId) return this.leadName.get(c.leadId) || c.counterpartEmail || '(lead)';
    return c.counterpartEmail || '—';
  }

  icon(c: Conversation): string {
    return c.direction === 'out' ? 'bi-arrow-up-right' : 'bi-arrow-down-left';
  }
}
