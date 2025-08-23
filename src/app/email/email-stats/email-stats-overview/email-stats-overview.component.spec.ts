import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

import {EmailStatsOverviewComponent} from './email-stats-overview.component';
import {SummaryRow} from '../email-stats.model';

describe('EmailStatsOverviewComponent', () => {
  // Polyfill/easy stubs dla Chart.js
  beforeAll(() => {
    if (!(window as any).requestAnimationFrame) {
      (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
    }
    const proto = HTMLCanvasElement.prototype as any;
    if (!proto.getContext) {
      proto.getContext = jasmine.createSpy('getContext').and.returnValue({});
    }
  });

  const SUMMARY: SummaryRow[] = [
    {
      messageId: 'm1',
      subject: 'Temat 1',
      to: 'a@x.pl',
      date: '2024-01-01T10:00:00Z',
      clicks: 5,
      lastTs: '2024-02-02T00:00:00Z'
    },
    {
      messageId: 'm2',
      subject: 'Temat 2',
      to: 'b@x.pl',
      date: '2024-01-03T10:00:00Z',
      clicks: 2,
      lastTs: '2024-02-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailStatsOverviewComponent]
    }).compileComponents();
  });

  it('renderuje tabelę, pozwala zaznaczyć wiersz i eksportować CSV dla wiersza', () => {
    const fixture = TestBed.createComponent(EmailStatsOverviewComponent);
    const comp = fixture.componentInstance;

    comp.summary = SUMMARY;
    comp.selectedMessageId = 'm2';
    comp.sinceDays = 30;
    fixture.detectChanges();

    // aktywny wiersz ma klasę .table-active
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
    expect(rows[1].nativeElement.classList).toContain('table-active');

    // kliknięcie "Szczegóły" emituje selectRow
    const selectSpy = spyOn(comp.selectRow, 'emit');
    const csvSpy = spyOn(comp.exportClicks, 'emit');

    const firstRowButtons = rows[0].queryAll(By.css('button'));
    // [0] -> Szczegóły, [1] -> CSV
    firstRowButtons[0].nativeElement.click();
    expect(selectSpy).toHaveBeenCalledWith(SUMMARY[0]);

    firstRowButtons[1].nativeElement.click();
    expect(csvSpy).toHaveBeenCalledWith('m1');
  });

  it('kliknięcie "Odśwież" emituje refreshRequested z bieżącą liczbą dni; przycisk "Eksport podsumowania" emituje exportSummary', () => {
    const fixture = TestBed.createComponent(EmailStatsOverviewComponent);
    const comp = fixture.componentInstance;

    comp.summary = SUMMARY;
    comp.sinceDays = 90;
    fixture.detectChanges();

    const refreshSpy = spyOn(comp.refreshRequested, 'emit');
    const exportSpy = spyOn(comp.exportSummary, 'emit');

    const refreshBtn = fixture.debugElement.query(By.css('.input-group button.btn.btn-primary'));
    const exportBtn = fixture.debugElement.query(By.css('button.btn.btn-outline-primary'));

    refreshBtn.nativeElement.click();
    exportBtn.nativeElement.click();

    expect(refreshSpy).toHaveBeenCalledWith(90);
    expect(exportSpy).toHaveBeenCalled();
  });
});
