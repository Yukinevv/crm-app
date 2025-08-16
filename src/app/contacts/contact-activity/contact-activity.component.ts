import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {DatePipe, NgClass, NgForOf, NgIf} from '@angular/common';
import {RouterLink} from '@angular/router';
import {ConversationService} from '../../email/conversations/conversations.service';
import {Conversation} from '../../email/conversations/conversations.model';

@Component({
  selector: 'app-contact-activity',
  standalone: true,
  imports: [NgIf, NgForOf, DatePipe, RouterLink, NgClass],
  templateUrl: './contact-activity.component.html',
  styleUrls: ['./contact-activity.component.scss']
})
export class ContactActivityComponent implements OnChanges {
  @Input() contactId?: string | null;

  loading = false;
  error: string | null = null;
  items: Conversation[] = [];

  constructor(private conv: ConversationService) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('contactId' in changes) {
      this.fetch();
    }
  }

  private fetch(): void {
    this.items = [];
    this.error = null;
    if (!this.contactId) return;

    this.loading = true;
    this.conv.list({contactId: this.contactId, limit: 200})
      .subscribe({
        next: list => {
          this.items = list.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          this.loading = false;
        },
        error: () => {
          this.error = 'Nie udało się pobrać aktywności';
          this.loading = false;
        }
      });
  }
}
