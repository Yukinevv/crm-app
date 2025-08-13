import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import {Chart, ChartConfiguration, registerables, ScatterDataPoint} from 'chart.js';
import 'chartjs-adapter-date-fns';

import {FormsModule} from '@angular/forms';
import {SummaryRow} from '../email-stats.model';
import {ClickEvent} from '../../email-stats.service';
import {DatePipe, NgForOf, NgIf} from '@angular/common';

Chart.register(...registerables);

@Component({
  selector: 'app-email-stats-details',
  standalone: true,
  imports: [FormsModule, NgIf, NgForOf, DatePipe],
  templateUrl: './email-stats-details.component.html',
  styleUrls: ['./email-stats-details.component.scss']
})
export class EmailStatsDetailsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() selected: SummaryRow | null = null;
  @Input() clicks: ClickEvent[] = [];

  @Output() exportClicks = new EventEmitter<string>();

  @ViewChild('timeChart') timeChartRef!: ElementRef<HTMLCanvasElement>;

  filterRecipient = '';
  filterUrl = '';

  private chart?: Chart;
  private viewReady = false;

  constructor(private ngZone: NgZone) {
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.drawOrUpdate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['clicks'] || changes['selected']) && this.viewReady) {
      this.drawOrUpdate();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  onExportClicks(): void {
    if (this.selected) {
      this.exportClicks.emit(this.selected.messageId);
    }
  }

  onFiltersChange(): void {
    this.drawOrUpdate();
  }

  get filteredClicks(): ClickEvent[] {
    const r = this.filterRecipient.trim().toLowerCase();
    const u = this.filterUrl.trim().toLowerCase();
    return (this.clicks || []).filter(c => {
      const okR = r ? (c.recipient || '').toLowerCase().includes(r) : true;
      const okU = u ? (c.url || '').toLowerCase().includes(u) : true;
      return okR && okU;
    });
  }

  // ===== Wykres czasu =====
  private drawOrUpdate(): void {
    const series = this.buildTimeSeries(this.filteredClicks);

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (!this.timeChartRef) return;

        if (!this.chart) {
          const cfg: ChartConfiguration<'line', ScatterDataPoint[], number> = {
            type: 'line',
            data: {
              datasets: [{
                label: 'Kliknięcia (dziennie)',
                data: series,
                parsing: false,
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
          this.chart = new Chart(canvas, cfg);
          queueMicrotask(() => this.chart?.resize());
        } else {
          (this.chart.data.datasets[0].data as ScatterDataPoint[]) = series;
          this.chart.update();
        }
      });
    });
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
      .map(([k, v]) => ({x: new Date(k).getTime(), y: v} as ScatterDataPoint));
  }
}
