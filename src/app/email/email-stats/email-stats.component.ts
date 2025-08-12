import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {forkJoin, Subscription} from 'rxjs';

import {Chart, ChartConfiguration, registerables, ScatterDataPoint} from 'chart.js';
import 'chartjs-adapter-date-fns';
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
  imports: [RouterLink, FormsModule, NgIf, DatePipe, NgForOf],
  styleUrls: ['./email-stats.component.scss']
})
export class EmailStatsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('topChart') topChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeChart') timeChartRef!: ElementRef<HTMLCanvasElement>;

  loading = true;
  refreshing = false;
  error: string | null = null;

  emails: Email[] = [];
  summary: SummaryRow[] = [];
  selected?: SummaryRow;
  selectedClicks: ClickEvent[] = [];

  // Filtry
  sinceDays = 365;
  filterRecipient = '';
  filterUrl = '';

  private subs: Subscription[] = [];
  private chartTop?: Chart;
  private chartTime?: Chart;

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
        this.dataReady = true;
        this.loading = false;
        this.tryRenderTopChart();
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
    this.tryRenderTopChart();
    this.tryRenderTimeChart();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.chartTop) {
      this.chartTop.destroy();
      this.chartTop = undefined;
    }
    if (this.chartTime) {
      this.chartTime.destroy();
      this.chartTime = undefined;
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
        this.updateTopChart();
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
      next: clicks => {
        this.selectedClicks = clicks;
        this.updateTimeChart();
      },
      error: () => {
        this.selectedClicks = [];
        this.updateTimeChart();
      }
    });
    this.subs.push(sub);
  }

  onFiltersChange(): void {
    this.updateTimeChart();
  }

  get filteredClicks(): ClickEvent[] {
    const r = this.filterRecipient.trim().toLowerCase();
    const u = this.filterUrl.trim().toLowerCase();

    return (this.selectedClicks || []).filter(c => {
      const okR = r ? (c.recipient || '').toLowerCase().includes(r) : true;
      const okU = u ? (c.url || '').toLowerCase().includes(u) : true;
      return okR && okU;
    });
  }

  exportSummaryCsv(): void {
    window.open(this.statsService.summaryCsvUrl(this.sinceDays), '_blank');
  }

  exportClicksCsv(row: SummaryRow): void {
    window.open(this.statsService.clicksCsvUrl(row.messageId), '_blank');
  }

  // ===== wykres Top 10 =====
  private tryRenderTopChart(): void {
    if (!this.viewReady || !this.dataReady) return;

    const top = this.summary.slice(0, 10);
    const labels = top.map(r => r.subject.length > 24 ? r.subject.slice(0, 22) + '…' : r.subject);
    const data = top.map(r => r.clicks);

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => this.renderTopChart(labels, data));
    });
  }

  private renderTopChart(labels: (string | string[])[], data: number[]): void {
    if (!this.topChartRef) return;

    if (this.chartTop) {
      this.chartTop.destroy();
      this.chartTop = undefined;
    }

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {labels, datasets: [{label: 'Kliknięcia', data}]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {legend: {display: true}},
        scales: {x: {ticks: {autoSkip: false}}}
      }
    };

    const canvas = this.topChartRef.nativeElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    this.chartTop = new Chart(canvas, cfg);
    queueMicrotask(() => this.chartTop?.resize());
  }

  private updateTopChart(): void {
    if (!this.chartTop) return this.tryRenderTopChart();
    const top = this.summary.slice(0, 10);
    this.chartTop.data.labels = top.map(r => r.subject.length > 24 ? r.subject.slice(0, 22) + '…' : r.subject);
    (this.chartTop.data.datasets[0].data as number[]) = top.map(r => r.clicks);
    this.chartTop.update();
  }

  // ===== wykres „kliknięcia w czasie” =====
  private tryRenderTimeChart(): void {
    if (!this.viewReady) return;
    const series = this.buildTimeSeries(this.filteredClicks);
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => this.renderTimeChart(series));
    });
  }

  private renderTimeChart(series: ScatterDataPoint[]): void {
    if (!this.timeChartRef) return;

    if (this.chartTime) {
      this.chartTime.destroy();
      this.chartTime = undefined;
    }

    const cfg: ChartConfiguration<'line', ScatterDataPoint[], number> = {
      type: 'line',
      data: {
        datasets: [{
          label: 'Kliknięcia (dziennie)',
          data: series,
          parsing: false, // używamy {x,y}
          fill: false,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {legend: {display: true}},
        scales: {
          x: {
            type: 'time',
            time: {unit: 'day'},
            ticks: {source: 'auto'}
          },
          y: {
            beginAtZero: true,
            ticks: {precision: 0}
          }
        }
      }
    };

    const canvas = this.timeChartRef.nativeElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    this.chartTime = new Chart(canvas, cfg);
    queueMicrotask(() => this.chartTime?.resize());
  }

  private updateTimeChart(): void {
    if (!this.timeChartRef) return;
    const series = this.buildTimeSeries(this.filteredClicks);
    if (!this.chartTime) return this.tryRenderTimeChart();
    (this.chartTime.data.datasets[0].data as ScatterDataPoint[]) = series;
    this.chartTime.update();
  }

  private buildTimeSeries(clicks: ClickEvent[]): ScatterDataPoint[] {
    const bucket = new Map<string, number>();
    for (const c of clicks) {
      if (!c.ts) continue;
      const d = new Date(c.ts);
      if (isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      bucket.set(key, (bucket.get(key) || 0) + 1);
    }

    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => {
        const t = new Date(k).getTime(); // ms timestamp
        return {x: t, y: v} as ScatterDataPoint;
      });
  }
}
