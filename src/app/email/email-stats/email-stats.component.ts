import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {forkJoin, Subscription} from 'rxjs';

import {Chart, ChartConfiguration, registerables} from 'chart.js';
import {ClickEvent, ClickSummary, EmailStatsService} from '../email-stats.service';
import {RouterLink} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {DatePipe, NgForOf, NgIf} from '@angular/common';

Chart.register(...registerables);

interface SummaryRow {
  messageId: string;
  subject: string;
  to: string;
  date: string;
  clicks: number;
  lastTs: string | null;
}

@Component({
  selector: 'app-email-stats',
  templateUrl: './email-stats.component.html',
  imports: [
    RouterLink,
    FormsModule,
    NgIf,
    DatePipe,
    NgForOf
  ],
  styleUrls: ['./email-stats.component.scss']
})
export class EmailStatsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('topChart') topChartRef!: ElementRef<HTMLCanvasElement>;

  loading = true;
  refreshing = false;
  error: string | null = null;

  emails: Email[] = [];
  summary: SummaryRow[] = [];
  selected?: SummaryRow;
  selectedClicks: ClickEvent[] = [];

  sinceDays = 365;
  private subs: Subscription[] = [];
  private chart?: Chart;

  private viewReady = false;
  private dataReady = false;

  constructor(
    private emailService: EmailService,
    private statsService: EmailStatsService,
    private ngZone: NgZone
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
        this.dataReady = true;
        this.tryRenderChart();
        if (this.summary.length) this.selectRow(this.summary[0]);
      },
      error: () => {
        this.error = 'Błąd ładowania statystyk';
        this.loading = false;
      }
    });
    this.subs.push(sub);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryRenderChart();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

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

  refresh(): void {
    this.refreshing = true;
    const sub = this.statsService.getSummary(this.sinceDays).subscribe({
      next: (summary) => {
        this.summary = this.joinSummary(this.emails, summary);
        this.refreshing = false;
        this.updateChart();
      },
      error: () => {
        this.error = 'Błąd odświeżenia statystyk';
        this.refreshing = false;
      }
    });
    this.subs.push(sub);
  }

  selectRow(row: SummaryRow): void {
    this.selected = row;
    const sub = this.statsService.getClicksByMessageId(row.messageId, 1000).subscribe({
      next: clicks => this.selectedClicks = clicks,
      error: () => this.selectedClicks = []
    });
    this.subs.push(sub);
  }

  exportSummaryCsv(): void {
    window.open(this.statsService.summaryCsvUrl(this.sinceDays), '_blank');
  }

  exportClicksCsv(row: SummaryRow): void {
    window.open(this.statsService.clicksCsvUrl(row.messageId), '_blank');
  }

  // ===== wykres =====
  private tryRenderChart(): void {
    if (!this.viewReady || !this.dataReady) return;

    const top = this.summary.slice(0, 10);
    const labels = top.map(r => r.subject.length > 24 ? r.subject.slice(0, 22) + '…' : r.subject);
    const data = top.map(r => r.clicks);

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.renderChart(labels, data);
      });
    });
  }

  private ensureChartCanvasCurrent(): boolean {
    if (!this.chart) return false;
    const currentCanvas = this.topChartRef?.nativeElement;
    const chartCanvas: HTMLCanvasElement | undefined = this.chart.canvas;
    if (!currentCanvas || !chartCanvas || currentCanvas !== chartCanvas) {
      // Canvas został prze-montowany to odtwórz wykres
      this.chart.destroy();
      this.chart = undefined;
      return false;
    }
    return true;
  }

  private renderChart(labels: (string | string[])[], data: number[]): void {
    if (!this.topChartRef) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{label: 'Kliknięcia', data}]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {display: true}
        },
        scales: {
          x: {ticks: {autoSkip: false}}
        }
      }
    };

    const canvas = this.topChartRef.nativeElement;

    canvas.style.width = '100%';
    canvas.style.height = '100%';

    this.chart = new Chart(canvas, cfg);

    // po pierwszym cyklu - wymuś przeliczenie
    queueMicrotask(() => this.chart?.resize());
  }

  private updateChart(): void {
    if (!this.ensureChartCanvasCurrent()) {
      return this.tryRenderChart();
    }
    const top = this.summary.slice(0, 10);
    const labels = top.map(r => r.subject.length > 24 ? r.subject.slice(0, 22) + '…' : r.subject);
    const values = top.map(r => r.clicks);

    this.chart!.data.labels = labels;
    (this.chart!.data.datasets[0].data as number[]) = values;
    this.chart!.update();
  }
}
