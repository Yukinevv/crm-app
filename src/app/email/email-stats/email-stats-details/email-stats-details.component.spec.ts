import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

import {EmailStatsDetailsComponent} from './email-stats-details.component';
import {ClickEvent} from '../../email-stats.service';
import {SummaryRow} from '../email-stats.model';

describe('EmailStatsDetailsComponent', () => {
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

  const SELECTED: SummaryRow = {
    messageId: 'm1',
    subject: 'Oferta A',
    to: 'a@firm.pl',
    date: '2024-01-01T00:00:00Z',
    clicks: 5,
    lastTs: '2024-02-02T00:00:00Z'
  };

  const CLICKS: ClickEvent[] = [
    {
      ts: '2024-02-01T10:00:00Z', url: 'https://ex.com/a', recipient: 'jan@ex.com', ip: '1.1.1.1',
      id: '',
      messageId: '',
      userAgent: null
    },
    {
      ts: '2024-02-01T11:00:00Z', url: 'https://ex.com/b', recipient: 'ewa@ex.com', ip: '1.1.1.2',
      id: '',
      messageId: '',
      userAgent: null
    },
    {
      ts: '2024-02-02T12:00:00Z', url: 'https://ex.com/a?x=1', recipient: 'jan@ex.com', ip: '1.1.1.3',
      id: '',
      messageId: '',
      userAgent: null
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailStatsDetailsComponent]
    }).compileComponents();
  });

  it('renderuje tabelę klików, filtruje po odbiorcy i URL, emituje eksport', () => {
    const fixture = TestBed.createComponent(EmailStatsDetailsComponent);
    const comp = fixture.componentInstance;

    comp.selected = SELECTED;
    comp.clicks = CLICKS;
    fixture.detectChanges(); // ngAfterViewInit -> narysuje wykres (stub canvas)

    // Na starcie - 3 rekordy
    let rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    // Pierwsze 3 to rekordy; brak wiersza "Brak wyników..." i "Wybierz wiadomość..."
    expect(rows.length).toBe(3);

    // Filtr: odbiorca = jan
    comp.filterRecipient = 'jan';
    comp.onFiltersChange();
    fixture.detectChanges();

    rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2); // 2 rekordy Jana

    // Filtr dodatkowo URL zawiera "/a"
    comp.filterUrl = '/a';
    comp.onFiltersChange();
    fixture.detectChanges();

    rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2); // obie pozycje Jana mają /a

    // Zaostrzamy filtr URL do "a?x=1"
    comp.filterUrl = 'a?x=1';
    comp.onFiltersChange();
    fixture.detectChanges();

    rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(1);

    // eksport
    const expSpy = spyOn(comp.exportClicks, 'emit');
    const exportBtn = fixture.debugElement.query(By.css('.card-header .btn'));
    exportBtn.nativeElement.click();
    expect(expSpy).toHaveBeenCalledWith('m1');
  });

  it('gdy selected=null – tabela pokazuje komunikat o wyborze wiadomości', () => {
    const fixture = TestBed.createComponent(EmailStatsDetailsComponent);
    const comp = fixture.componentInstance;

    comp.selected = null;
    comp.clicks = [];
    fixture.detectChanges();

    const txt = fixture.debugElement.query(By.css('tbody tr td')).nativeElement.textContent.trim();
    expect(txt).toContain('Wybierz wiadomość w podsumowaniu');
  });

  it('gdy nie ma wyników po filtrach – pokazuje stosowny komunikat', () => {
    const fixture = TestBed.createComponent(EmailStatsDetailsComponent);
    const comp = fixture.componentInstance;

    comp.selected = SELECTED;
    comp.clicks = CLICKS;
    fixture.detectChanges();

    comp.filterRecipient = 'nie-ma-takiego';
    comp.onFiltersChange();
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('tbody tr td')).nativeElement as HTMLElement;
    expect(cell.textContent?.trim()).toBe('Brak wyników dla zastosowanych filtrów');
  });
});
