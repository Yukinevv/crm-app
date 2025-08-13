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
import {FormsModule} from '@angular/forms';

import {Chart, ChartConfiguration, registerables} from 'chart.js';
import {SummaryRow} from '../email-stats.model';
import {DatePipe, NgForOf, NgIf} from '@angular/common';

Chart.register(...registerables);

@Component({
  selector: 'app-email-stats-overview',
  standalone: true,
  imports: [FormsModule, NgIf, NgForOf, DatePipe],
  templateUrl: './email-stats-overview.component.html',
  styleUrls: ['./email-stats-overview.component.scss']
})
export class EmailStatsOverviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() summary: SummaryRow[] = [];
  @Input() sinceDays = 365;
  @Input() loading = false;
  @Input() refreshing = false;
  @Input() selectedMessageId: string | null = null;

  @Output() refreshRequested = new EventEmitter<number>();
  @Output() exportSummary = new EventEmitter<void>();
  @Output() selectRow = new EventEmitter<SummaryRow>();
  @Output() exportClicks = new EventEmitter<string>();

  @ViewChild('topChart') topChartRef!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private viewReady = false;

  constructor(private ngZone: NgZone) {
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.drawOrUpdate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] && this.viewReady) {
      this.drawOrUpdate();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  onRefreshClick(): void {
    this.refreshRequested.emit(this.sinceDays);
  }

  onExportSummaryClick(): void {
    this.exportSummary.emit();
  }

  onSelectRow(row: SummaryRow): void {
    this.selectRow.emit(row);
  }

  onExportClicksRow(row: SummaryRow): void {
    this.exportClicks.emit(row.messageId);
  }

  // ===== wykres Top 10 =====
  private drawOrUpdate(): void {
    const top = this.summary.slice(0, 10);
    const labels = top.map(r => r.subject.length > 24 ? r.subject.slice(0, 22) + '…' : r.subject);
    const data = top.map(r => r.clicks);

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (!this.topChartRef) return;

        if (!this.chart) {
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
          this.chart = new Chart(canvas, cfg);
          queueMicrotask(() => this.chart?.resize());
        } else {
          this.chart.data.labels = labels;
          (this.chart.data.datasets[0].data as number[]) = data;
          this.chart.update();
        }
      });
    });
  }
}
