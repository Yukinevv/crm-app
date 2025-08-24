import {TestBed} from '@angular/core/testing';
import {of, throwError} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';

import {EmailStatsComponent} from './email-stats.component';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {ClickEvent, ClickSummary, EmailStatsService} from '../email-stats.service';

describe('EmailStatsComponent', () => {
  let emailSvc: jasmine.SpyObj<EmailService>;
  let statsSvc: jasmine.SpyObj<EmailStatsService>;

  // Polyfill/easy stubs dla środowiska testowego
  beforeAll(() => {
    if (!(window as any).requestAnimationFrame) {
      (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
    }
    // Chart.js wymaga getContext
    const proto = HTMLCanvasElement.prototype as any;
    if (!proto.getContext) {
      proto.getContext = jasmine.createSpy('getContext').and.returnValue({});
    }
  });

  const EMAILS: Email[] = [
    {
      id: 'e1',
      from: 'me@acme.pl',
      to: 'a@firm.pl',
      subject: 'Oferta A',
      body: '...',
      date: '2024-01-01T10:00:00Z',
      isRead: true,
      messageId: 'm1'
    },
    {
      id: 'e2',
      from: 'me@acme.pl',
      to: 'b@firm.pl',
      subject: 'Oferta B',
      body: '...',
      date: '2024-01-05T10:00:00Z',
      isRead: true,
      messageId: 'm2'
    }
  ];

  const SUMMARY: ClickSummary[] = [
    {messageId: 'm2', count: 3, lastTs: '2024-02-02T12:00:00Z'},
    {messageId: 'm1', count: 10, lastTs: '2024-02-03T12:00:00Z'}
  ];

  const CLICKS_M1: ClickEvent[] = [
    {
      ts: '2024-02-02T10:00:00Z', url: 'https://ex.com/a', recipient: 'a@firm.pl', ip: '1.1.1.1',
      id: '',
      messageId: '',
      userAgent: null
    },
    {
      ts: '2024-02-03T10:00:00Z', url: 'https://ex.com/a', recipient: 'a@firm.pl', ip: '1.1.1.2',
      id: '',
      messageId: '',
      userAgent: null
    }
  ];

  beforeEach(async () => {
    emailSvc = jasmine.createSpyObj<EmailService>('EmailService', ['getEmails']);
    statsSvc = jasmine.createSpyObj<EmailStatsService>('EmailStatsService', [
      'getSummary',
      'getClicksByMessageId',
      'summaryCsvUrl',
      'clicksCsvUrl'
    ]);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, EmailStatsComponent],
      providers: [
        {provide: EmailService, useValue: emailSvc},
        {provide: EmailStatsService, useValue: statsSvc}
      ]
    }).compileComponents();
  });

  it('ngOnInit: ładuje skrzynkę + podsumowanie, sortuje malejąco po klikach i wybiera pierwszy wiersz', () => {
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(of(SUMMARY));
    statsSvc.getClicksByMessageId.and.returnValue(of(CLICKS_M1));

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges(); // ngOnInit

    // dane podstawowe
    expect(comp.loading).toBeFalse();
    expect(comp.error).toBeNull();
    expect(comp.emails.length).toBe(2);

    // join + sort po clicks desc -> m1 (10) przed m2 (3)
    expect(comp.summary.length).toBe(2);
    expect(comp.summary[0].messageId).toBe('m1');
    expect(comp.summary[0].clicks).toBe(10);
    expect(comp.summary[1].messageId).toBe('m2');

    // auto select pierwszego + pobranie klików
    expect(comp.selected?.messageId).toBe('m1');
    expect(statsSvc.getClicksByMessageId).toHaveBeenCalledWith('m1', 1000);
    expect(comp.selectedClicks.length).toBe(2);
  });

  it('ngOnInit: obsługa błędu (forkJoin -> error)', () => {
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Błąd ładowania statystyk');
    expect(comp.summary.length).toBe(0);
  });

  it('onRefreshRequested: ustawia sinceDays, pobiera summary i zachowuje/aktualizuje wybór', () => {
    // init
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(of(SUMMARY));
    statsSvc.getClicksByMessageId.and.returnValue(of([]));

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // wybrany m1 (największe kliknięcia)
    expect(comp.selected?.messageId).toBe('m1');

    // Po odświeżeniu zwracamy tylko m2 -> powinno przełączyć wybór na pierwszy z nowych
    (statsSvc.getClicksByMessageId as any).calls.reset();
    statsSvc.getSummary.and.returnValue(of([{messageId: 'm2', count: 5, lastTs: '2024-02-10T12:00:00Z'}]));

    comp.onRefreshRequested(30);

    expect(comp.sinceDays).toBe(30);
    expect(comp.refreshing).toBeFalse();
    expect(comp.summary.length).toBe(1);
    expect(comp.summary[0].messageId).toBe('m2');
    expect(comp.selected?.messageId).toBe('m2');
    expect(statsSvc.getClicksByMessageId).toHaveBeenCalledWith('m2', 1000);
  });

  it('onRefreshRequested: obsługa błędu ustawia komunikat', () => {
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(of(SUMMARY));
    statsSvc.getClicksByMessageId.and.returnValue(of([]));

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    statsSvc.getSummary.and.returnValue(throwError(() => new Error('x')));
    comp.onRefreshRequested(7);

    expect(comp.refreshing).toBeFalse();
    expect(comp.error).toBe('Błąd odświeżenia statystyk');
  });

  it('onSelectRow: pobiera kliknięcia dla wskazanego messageId', () => {
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(of(SUMMARY));
    statsSvc.getClicksByMessageId.and.returnValue(of(CLICKS_M1));

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // wybór innego wiersza (m2)
    (statsSvc.getClicksByMessageId as any).calls.reset();
    // @ts-ignore
    statsSvc.getClicksByMessageId.and.returnValue(of([{ts: '2024-02-01T00:00:00Z', url: 'u'}]));

    comp.onSelectRow({
      messageId: 'm2',
      subject: 'Oferta B',
      to: 'b@firm.pl',
      date: '2024-01-05T10:00:00Z',
      clicks: 3,
      lastTs: '2024-02-02T12:00:00Z'
    });

    expect(statsSvc.getClicksByMessageId).toHaveBeenCalledWith('m2', 1000);
    expect(comp.selected?.messageId).toBe('m2');
    expect(comp.selectedClicks.length).toBe(1);
  });

  it('onExportSummary / onExportClicks: otwiera nowe okno z URL CSV', () => {
    emailSvc.getEmails.and.returnValue(of(EMAILS));
    statsSvc.getSummary.and.returnValue(of(SUMMARY));
    statsSvc.getClicksByMessageId.and.returnValue(of([]));
    statsSvc.summaryCsvUrl.and.returnValue('/api/summary.csv');
    statsSvc.clicksCsvUrl.and.returnValue('/api/clicks_m1.csv');

    const openSpy = spyOn(window, 'open');

    const fixture = TestBed.createComponent(EmailStatsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.onExportSummary();
    expect(statsSvc.summaryCsvUrl).toHaveBeenCalledWith(365); // domyślnie 365
    expect(openSpy).toHaveBeenCalledWith('/api/summary.csv', '_blank');

    comp.onExportClicks('m1');
    expect(statsSvc.clicksCsvUrl).toHaveBeenCalledWith('m1');
    expect(openSpy).toHaveBeenCalledWith('/api/clicks_m1.csv', '_blank');
  });
});
