import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {EmailListComponent} from './email-list.component';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';
import {EmailService} from '../email.service';
import {InboxItem, InboxQuery, InboxService} from '../inbox.service';
import {ImapConfigView, ImapSettingsService} from '../imap-settings.service';

// ---- Mocki serwisów ----
class MockInboxService {
  list = jasmine.createSpy('list').and.returnValue(
    of<InboxItem[]>([
      {
        id: 'mh:1',
        provider: 'mailhog',
        from: 'alice@example.com',
        to: 'me@test.local',
        subject: 'Hello',
        date: '2025-01-01T10:00:00.000Z',
        isRead: false,
        preview: 'Hi!'
      },
      {
        id: 'mh:2',
        provider: 'mailhog',
        from: 'bob@example.com',
        to: 'me@test.local',
        subject: 'Status',
        date: '2025-01-02T09:00:00.000Z',
        isRead: true,
        preview: 'OK'
      }
    ])
  );
}

class MockEmailService {
  getEmails = jasmine.createSpy('getEmails').and.returnValue(
    of([
      {id: 'e1', from: 'me', to: 'a', subject: 'S1', body: '', date: '2025-01-01T10:00:00.000Z', isRead: false},
      {id: 'e2', from: 'me', to: 'b', subject: 'S2', body: '', date: '2025-01-03T10:00:00.000Z', isRead: true},
      {id: 'e3', from: 'me', to: 'c', subject: 'S3', body: '', date: '2025-01-02T10:00:00.000Z', isRead: false}
    ])
  );

  markAsRead = jasmine.createSpy('markAsRead').and.callFake((id: string) =>
    of({id, from: 'me', to: 'x', subject: 'S', body: '', date: '2025-01-03T10:00:00.000Z', isRead: true})
  );
}

class MockImapSettingsService {
  get = jasmine.createSpy('get').and.returnValue(
    of<ImapConfigView>({
      host: 'imap.example.com',
      port: 993,
      secure: true,
      user: 'u@example.com',
      mailbox: 'INBOX',
      hasPassword: true,
      updatedAt: new Date().toISOString()
    })
  );
}

describe('EmailListComponent', () => {
  let router: Router;
  let inbox: MockInboxService;
  let email: MockEmailService;
  let imap: MockImapSettingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailListComponent, RouterTestingModule],
      providers: [
        {provide: InboxService, useClass: MockInboxService},
        {provide: EmailService, useClass: MockEmailService},
        {provide: ImapSettingsService, useClass: MockImapSettingsService}
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    inbox = TestBed.inject(InboxService) as unknown as MockInboxService;
    email = TestBed.inject(EmailService) as unknown as MockEmailService;
    imap = TestBed.inject(ImapSettingsService) as unknown as MockImapSettingsService;
  });

  it('ngOnInit: sprawdza IMAP i ładuje Odebrane (pierwszy raz) – lista zapełniona', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges(); // ngOnInit

    expect(imap.get).toHaveBeenCalled();
    expect(comp.imapConfigured).toBeTrue();

    expect(comp.inboxLoading).toBeFalse();
    expect(comp.inboxError).toBeNull();
    expect(inbox.list).toHaveBeenCalledWith(jasmine.objectContaining<InboxQuery>({limit: 200}));
    expect(comp.inbox.length).toBe(2);
  });

  it('loadInbox: ustawia błąd, gdy serwis rzuca wyjątek', () => {
    (inbox.list as any).and.returnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.inboxLoading).toBeFalse();
    expect(comp.inboxError).toBe('Błąd ładowania odebranych');
  });

  it('valueChanges filtrów: NIE woła ponownie list(), tylko filtruje lokalnie cache w zakładce inbox', fakeAsync(() => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges(); // pierwszy loadInbox
    (inbox.list as any).calls.reset();

    // aktywna zakładka inbox
    comp.inboxForm.get('q')!.setValue('alice');
    tick(310); // debounce 300ms

    // nie ma kolejnego requestu do IMAP
    expect(inbox.list).not.toHaveBeenCalled();

    // za to lista powinna być przefiltrowana lokalnie do 1 pozycji (alice)
    expect(comp.inbox.length).toBe(1);
    expect(comp.inbox[0].from).toContain('alice');
  }));

  it('setTab(sent): ładuje wysłane i sortuje malejąco po dacie', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges(); // inbox
    comp.setTab('sent');

    expect(email.getEmails).toHaveBeenCalled();
    expect(comp.sentLoading).toBeFalse();

    // malejąco: e2 (03) -> e3 (02) -> e1 (01)
    expect(comp.emails.map(e => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('openEmail: markAsRead -> nawigacja do /email/read/:id', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const navSpy = spyOn(router, 'navigate').and.stub();
    comp.openEmail({
      id: 'e1',
      from: 'me',
      to: 'x',
      subject: 'S',
      body: '',
      date: '2025-01-03T10:00:00.000Z',
      isRead: false
    });

    expect(email.markAsRead).toHaveBeenCalledWith('e1');
    expect(navSpy).toHaveBeenCalledWith(['/email/read', 'e1']);
  });

  it('openInbox: nawigacja do /email/inbox/:id', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const navSpy = spyOn(router, 'navigate').and.stub();
    comp.openInbox({
      id: 'mh:1',
      provider: 'mailhog',
      from: 'a',
      to: 'b',
      subject: 'S',
      date: '2025-01-01T00:00:00.000Z',
      isRead: false,
      preview: ''
    });

    expect(navSpy).toHaveBeenCalledWith(['/email/inbox', 'mh:1']);
  });

  it('resetInboxFilters: czyści form i jedynie filtruje cache (bez kolejnego list())', fakeAsync(() => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit -> subskrypcje + 1 loadInbox

    (inbox.list as any).calls.reset();

    comp.inboxForm.patchValue({
      q: 'x',
      from: 'y',
      subject: 'z',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-02',
      unread: true
    });

    comp.resetInboxFilters();

    tick(320);
    fixture.detectChanges();

    // brak ponownego requestu
    expect(inbox.list).not.toHaveBeenCalled();

    // po resecie filtry puste - powinniśmy widzieć cały cache (2 wiersze)
    expect(comp.inbox.length).toBe(2);
  }));

  it('compose(): nawigacja do /email/compose', () => {
    const fixture = TestBed.createComponent(EmailListComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const navSpy = spyOn(router, 'navigate').and.stub();
    comp.compose();
    expect(navSpy).toHaveBeenCalledWith(['/email/compose']);
  });
});
