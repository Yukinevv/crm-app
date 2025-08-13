import {Component, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin, Subscription} from 'rxjs';

import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {ClickEvent, ClickSummary, EmailStatsService} from '../email-stats.service';
import {EmailStatsOverviewComponent} from './email-stats-overview/email-stats-overview.component';
import {EmailStatsDetailsComponent} from './email-stats-details/email-stats-details.component';
import {SummaryRow} from './email-stats.model';

@Component({
  selector: 'app-email-stats',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule, EmailStatsOverviewComponent, EmailStatsDetailsComponent],
  templateUrl: './email-stats.component.html',
  styleUrls: ['./email-stats.component.scss']
})
export class EmailStatsComponent implements OnInit {
  loading = true;       // pierwsze ładowanie (nie wycina layoutu dzieci)
  refreshing = false;   // odświeżanie agregatów
  error: string | null = null;

  emails: Email[] = [];
  summary: SummaryRow[] = [];
  selected?: SummaryRow;
  selectedClicks: ClickEvent[] = [];
  sinceDays = 365;

  private subs: Subscription[] = [];

  constructor(
    private emailService: EmailService,
    private statsService: EmailStatsService
  ) {
  }

  ngOnInit(): void {
    const s1 = this.emailService.getEmails();
    const s2 = this.statsService.getSummary(this.sinceDays);

    const sub = forkJoin([s1, s2]).subscribe({
      next: ([emails, summary]) => {
        this.emails = emails;
        this.summary = this.joinSummary(emails, summary);
        this.loading = false;
        if (this.summary.length) {
          this.onSelectRow(this.summary[0]);
        }
      },
      error: () => {
        this.error = 'Błąd ładowania statystyk';
        this.loading = false;
      }
    });
    this.subs.push(sub);
  }

  // Mapowanie ClickSummary -> SummaryRow
  private joinSummary(emails: Email[], stats: ClickSummary[]): SummaryRow[] {
    const byMsg = new Map<string, Email>();
    emails.forEach(e => {
      if (e.messageId) byMsg.set(e.messageId, e);
    });

    const rows: SummaryRow[] = stats.map(s => {
      const mail = byMsg.get(s.messageId);
      return {
        messageId: s.messageId,
        subject: mail?.subject || '(nie znaleziono w skrzynce)',
        to: mail?.to || '—',
        date: mail?.date || '',
        clicks: s.count,
        lastTs: s.lastTs
      };
    });
    rows.sort((a, b) => b.clicks - a.clicks);
    return rows;
  }

  onRefreshRequested(days: number): void {
    this.sinceDays = days;
    this.refreshing = true;
    const sub = this.statsService.getSummary(this.sinceDays).subscribe({
      next: (summary) => {
        this.summary = this.joinSummary(this.emails, summary);
        this.refreshing = false;
        // zachowujemy bieżący wybór, jeśli istnieje
        if (this.selected) {
          const stillExists = this.summary.some(r => r.messageId === this.selected!.messageId);
          if (!stillExists && this.summary.length) {
            this.onSelectRow(this.summary[0]);
          }
        }
      },
      error: () => {
        this.error = 'Błąd odświeżenia statystyk';
        this.refreshing = false;
      }
    });
    this.subs.push(sub);
  }

  onSelectRow(row: SummaryRow): void {
    this.selected = row;
    const sub = this.statsService.getClicksByMessageId(row.messageId, 1000).subscribe({
      next: clicks => this.selectedClicks = clicks,
      error: () => this.selectedClicks = []
    });
    this.subs.push(sub);
  }

  onExportSummary(): void {
    window.open(this.statsService.summaryCsvUrl(this.sinceDays), '_blank');
  }

  onExportClicks(messageId: string): void {
    window.open(this.statsService.clicksCsvUrl(messageId), '_blank');
  }
}
