import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';

import {InboxDetailComponent} from './inbox-detail.component';
import {InboxItem, InboxMessage, InboxService} from '../inbox.service';
import {ConversationService} from '../conversations/conversations.service';
import {AuthService} from '../../auth/auth.service';
import {DomSanitizer} from '@angular/platform-browser';

describe('InboxDetailComponent', () => {
  let inbox: jasmine.SpyObj<InboxService>;
  let conv: jasmine.SpyObj<ConversationService>;
  let auth: { user$: any };

  const routeWithId = (id: string | null) => ({
    snapshot: {paramMap: convertToParamMap(id ? {id} : {})}
  });

  beforeEach(async () => {
    inbox = jasmine.createSpyObj<InboxService>('InboxService', ['markRead', 'getMessage', 'list']);
    conv = jasmine.createSpyObj<ConversationService>('ConversationService', ['logEmailAutoLink']);
    auth = {user$: of({email: 'me@acme.pl'})};

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, InboxDetailComponent],
      providers: [
        {provide: InboxService, useValue: inbox},
        {provide: ConversationService, useValue: conv},
        {provide: AuthService, useValue: auth},
        {provide: ActivatedRoute, useValue: routeWithId('m1')}, // domyślnie mamy id
      ]
    }).compileComponents();
  });

  function setRouteId(id: string | null) {
    TestBed.overrideProvider(ActivatedRoute, {useValue: routeWithId(id)});
  }

  it('gdy brak id w URL – ustawia błąd i nie woła serwisów', () => {
    setRouteId(null);

    const fixture = TestBed.createComponent(InboxDetailComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Nie wybrano wiadomości');
    expect(inbox.markRead).not.toHaveBeenCalled();
    expect(inbox.getMessage).not.toHaveBeenCalled();
  });

  it('ngOnInit: markRead + getMessage; render bodyText (escape + link + <br>) i auto-log "in"', () => {
    setRouteId('m1');

    const MSG: InboxMessage = {
      id: 'm1',
      provider: 'imap',
      from: 'Jan Kowalski <jan@x.pl>',
      to: 'Me <me@acme.pl>',
      subject: 'Hello',
      date: '2024-02-01T10:00:00Z',
      bodyHtml: null,
      bodyText: 'Cześć <b>Ty</b>\nhttps://ex.com/oferta'
    };

    inbox.markRead.and.returnValue(of({ok: true}));
    inbox.getMessage.and.returnValue(of(MSG));
    conv.logEmailAutoLink.and.returnValue(of({ok: true, conversation: {} as any}));

    const fixture = TestBed.createComponent(InboxDetailComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(inbox.markRead).toHaveBeenCalledWith('m1');
    expect(inbox.getMessage).toHaveBeenCalledWith('m1');

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBeNull();
    expect(comp.msg?.subject).toBe('Hello');

    const html = (comp.bodyHtml as any).changingThisBreaksApplicationSecurity as string;
    expect(html).toContain('Cześć &lt;b&gt;Ty&lt;/b&gt;');
    expect(html).toContain('<br>');
    expect(html).toContain(
      '<a href="https://ex.com/oferta" target="_blank" rel="noopener noreferrer">https://ex.com/oferta</a>'
    );

    expect(conv.logEmailAutoLink).toHaveBeenCalledTimes(1);
    expect(conv.logEmailAutoLink).toHaveBeenCalledWith(jasmine.objectContaining({
      userId: '',
      direction: 'in',
      subject: 'Hello',
      body: 'Cześć <b>Ty</b>\nhttps://ex.com/oferta',
      date: '2024-02-01T10:00:00Z',
      emailId: 'm1',
      counterpartEmail: 'jan@x.pl'
    }));
  });

  it('ngOnInit: błąd getMessage -> komunikat i loading=false', () => {
    setRouteId('m404');

    inbox.markRead.and.returnValue(of({ok: true}));
    inbox.getMessage.and.returnValue(throwError(() => new Error('404')));

    const fixture = TestBed.createComponent(InboxDetailComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Nie można wczytać wiadomości');
  });

  it('reply(): nawigacja do /email/compose z poprawnymi query params (Re: + quote)', () => {
    setRouteId('m1');

    const MSG: InboxMessage = {
      id: 'm1',
      provider: 'imap',
      from: 'Jan <jan@x.pl>',
      to: 'Me <me@acme.pl>',
      subject: 'Oferta',
      date: '2024-02-01T10:00:00Z',
      bodyHtml: null,
      bodyText: 'Treść'
    };

    inbox.markRead.and.returnValue(of({ok: true}));
    inbox.getMessage.and.returnValue(of(MSG));
    conv.logEmailAutoLink.and.returnValue(of({ok: true, conversation: {} as any}));

    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(InboxDetailComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.reply();

    expect(navSpy).toHaveBeenCalled();
    const [commands, extras] = navSpy.calls.mostRecent().args as any[];
    expect(commands).toEqual(['/email/compose']);
    expect(extras.queryParams.to).toBe('jan@x.pl');
    expect(extras.queryParams.subject).toBe('Re: Oferta');
    expect(String(extras.queryParams.body)).toContain('--- Oryginalna wiadomość ---');
    expect(String(extras.queryParams.body)).toContain('Od: Jan <jan@x.pl>');
  });

  it('importThread(): wyszukuje kandydatów, liczy kierunki in/out i loguje, po czym pokazuje alert z liczbą', () => {
    setRouteId('m1');

    const CURRENT: InboxMessage = {
      id: 'm1',
      provider: 'imap',
      from: 'Jan <jan@x.pl>',
      to: 'Me <me@acme.pl>',
      subject: 'Re: Oferta XXL',
      date: '2024-02-01T10:00:00Z',
      bodyHtml: null,
      bodyText: 'Treść'
    };

    inbox.markRead.and.returnValue(of({ok: true}));
    inbox.getMessage.and.returnValue(of(CURRENT));
    conv.logEmailAutoLink.and.returnValue(of({ok: true, conversation: {} as any}));

    const ITEMS: InboxItem[] = [
      {
        id: 'm2',
        provider: 'imap',
        from: 'Me <me@acme.pl>',
        to: 'Jan <jan@x.pl>',
        subject: 'Oferta XXL',
        date: '2024-02-02T10:00:00Z',
        isRead: true,
        preview: 'P-2'
      },
      {
        id: 'm3',
        provider: 'imap',
        from: 'Jan <jan@x.pl>',
        to: 'Me <me@acme.pl>',
        subject: 'Fwd: Oferta XXL',
        date: '2024-02-03T10:00:00Z',
        isRead: true,
        preview: 'P-3'
      },
      {
        id: 'm4',
        provider: 'imap',
        from: 'Jan <jan@x.pl>',
        to: 'Me <me@acme.pl>',
        subject: 'Inny temat',
        date: '2024-02-04T10:00:00Z',
        isRead: true,
        preview: 'P-4'
      },
      {
        id: 'm5',
        provider: 'imap',
        from: 'Adam <adam@x.pl>',
        to: 'Me <me@acme.pl>',
        subject: 'Oferta XXL',
        date: '2024-02-05T10:00:00Z',
        isRead: true,
        preview: 'P-5'
      }
    ];

    inbox.list.and.returnValue(of(ITEMS));
    const alertSpy = spyOn(window, 'alert');

    const fixture = TestBed.createComponent(InboxDetailComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // auto-log z ngOnInit już się wykonał -> zapamiętaj stan
    const before = conv.logEmailAutoLink.calls.count();

    comp.importThread();

    expect(inbox.list).toHaveBeenCalledWith({limit: 300});

    // sprawdzamy PRZYROST (tylko wywołania z importThread)
    const newCalls = conv.logEmailAutoLink.calls.all().slice(before);
    expect(newCalls.length).toBe(2);

    const callOut = conv.logEmailAutoLink.calls.all().find(c => (c.args[0] as any).emailId === 'm2')!;
    expect(callOut.args[0]).toEqual(jasmine.objectContaining({
      userId: '',
      direction: 'out',
      subject: 'Oferta XXL',
      body: 'P-2',
      date: '2024-02-02T10:00:00Z',
      emailId: 'm2',
      counterpartEmail: 'jan@x.pl'
    }));

    const callIn = conv.logEmailAutoLink.calls.all().find(c => (c.args[0] as any).emailId === 'm3')!;
    expect(callIn.args[0]).toEqual(jasmine.objectContaining({
      userId: '',
      direction: 'in',
      subject: 'Fwd: Oferta XXL',
      body: 'P-3',
      date: '2024-02-03T10:00:00Z',
      emailId: 'm3',
      counterpartEmail: 'jan@x.pl'
    }));

    expect(alertSpy).toHaveBeenCalledWith('Zaimportowano 2 wiadomości do konwersacji');
  });

  it('renderBody: gdy bodyHtml jest dostępne – bypassSecurityTrustHtml dostaje HTML bez zmian', () => {
    setRouteId('m1');

    const MSG: InboxMessage = {
      id: 'm1',
      provider: 'imap',
      from: 'Jan <jan@x.pl>',
      to: 'Me <me@acme.pl>',
      subject: 'S',
      date: '2024-02-01T10:00:00Z',
      bodyHtml: '<p><strong>Hej</strong> &copy;</p>',
      bodyText: null
    };

    inbox.markRead.and.returnValue(of({ok: true}));
    inbox.getMessage.and.returnValue(of(MSG));
    conv.logEmailAutoLink.and.returnValue(of({ok: true, conversation: {} as any}));

    const sanitizer = TestBed.inject(DomSanitizer);
    const spyBypass = spyOn(sanitizer, 'bypassSecurityTrustHtml').and.callThrough();

    const fixture = TestBed.createComponent(InboxDetailComponent);
    fixture.detectChanges();

    expect(spyBypass).toHaveBeenCalledWith('<p><strong>Hej</strong> &copy;</p>');
  });
});
