import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {BehaviorSubject, of, throwError} from 'rxjs';

import {EmailService} from './email.service';
import {AuthService} from '../auth/auth.service';
import {ConversationService} from './conversations/conversations.service';

class MockAuthService {
  user$ = new BehaviorSubject<any>({
    uid: 'u1',
    email: 'sender@crm-app.test',
    displayName: 'Sender'
  });
}

class MockConversationService {
  // obie metody używane przez EmailService
  logEmail = jasmine.createSpy('logEmail').and.returnValue(
    of({ok: true, conversation: {} as any})
  );
  logEmailAutoLink = jasmine.createSpy('logEmailAutoLink').and.returnValue(
    of({ok: true, conversation: {} as any})
  );
}

describe('EmailService', () => {
  let service: EmailService;
  let http: HttpTestingController;
  let conv: MockConversationService;
  let auth: MockAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        EmailService,
        {provide: AuthService, useClass: MockAuthService},
        {provide: ConversationService, useClass: MockConversationService}
      ]
    });

    service = TestBed.inject(EmailService);
    http = TestBed.inject(HttpTestingController);
    conv = TestBed.inject(ConversationService) as unknown as MockConversationService;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
  });

  afterEach(() => {
    http.verify();
  });

  it('getEmails(): pobiera tylko maile zalogowanego usera (param userId)', (done) => {
    service.getEmails().subscribe(list => {
      expect(list.length).toBe(2);
      done();
    });

    const req = http.expectOne(r => r.url === '/api/emails' && r.params.get('userId') === 'u1');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'e1',
        from: 'me',
        to: 'a',
        subject: 'S1',
        body: '',
        date: '2025-01-01T10:00:00.000Z',
        isRead: false,
        userId: 'u1'
      },
      {
        id: 'e2',
        from: 'me',
        to: 'b',
        subject: 'S2',
        body: '',
        date: '2025-01-02T10:00:00.000Z',
        isRead: true,
        userId: 'u1'
      }
    ]);
  });

  it('powinien wysłać mail (backend), zapisać w /api/emails i zalogować konwersację z contactId', (done) => {
    // ustabilizuj messageId żeby łatwo robić aserty
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_test');

    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'wiktor@testowa.pl',
        subject: 'Temat',
        body: 'Proszę kliknąć: https://example.com/page',
        trackLinks: true
      },
      {contactId: 'c1'}
    ).subscribe(saved => {
      expect(saved).toBeTruthy();

      // logEmail z contactId
      expect(conv.logEmail).toHaveBeenCalled();
      const payload = conv.logEmail.calls.mostRecent().args[0];
      expect(payload.contactId).toBe('c1');
      expect(payload.direction).toBe('out');
      expect(payload.counterpartEmail).toBe('wiktor@testowa.pl');

      // i nie wywołuje auto-link w tym wariancie
      expect(conv.logEmailAutoLink).not.toHaveBeenCalled();
      done();
    });

    // wysyłka fizyczna
    const sendReq = http.expectOne('/api/mail/send');
    expect(sendReq.request.method).toBe('POST');
    const sendBody = sendReq.request.body as any;
    expect(sendBody.messageId).toBe('m_test');
    expect(sendBody.body).toContain('/api/t?');
    expect(sendBody.body).toContain('m=m_test');
    sendReq.flush({ok: true});

    // zapis w skrzynce (json-server)
    const saveReq = http.expectOne('/api/emails');
    expect(saveReq.request.method).toBe('POST');
    const mailPayload = saveReq.request.body as any;
    expect(mailPayload.userId).toBe('u1');
    expect(mailPayload.tags?.utm_content).toBe('m_test');
    expect(mailPayload.body).toContain('/api/t?');
    saveReq.flush({id: 'e1', ...mailPayload});
  });

  it('powinien zalogować konwersację przez auto-link gdy brak contactId', (done) => {
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_auto');

    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'auto@link.pl',
        subject: 'S',
        body: 'B',
        trackLinks: false
      }
    ).subscribe(saved => {
      expect(saved).toBeTruthy();

      // powinno polecieć auto-link
      expect(conv.logEmailAutoLink).toHaveBeenCalled();
      const payload = conv.logEmailAutoLink.calls.mostRecent().args[0];
      expect(payload.userId).toBe('u1');
      expect(payload.counterpartEmail).toBe('auto@link.pl');

      // i nie wywołuje logEmail w tym wariancie
      expect(conv.logEmail).not.toHaveBeenCalled();

      done();
    });

    const sendReq = http.expectOne('/api/mail/send');
    sendReq.flush({ok: true});

    const saveReq = http.expectOne('/api/emails');
    saveReq.flush({id: 'eA', ...saveReq.request.body});
  });

  it('powinien przeżyć błąd logowania konwersacji (auto-link) – mail zapisany OK', (done) => {
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_x');

    // symuluj błąd logEmailAutoLink (bo brak contactId)
    conv.logEmailAutoLink.and.returnValue(throwError(() => new Error('fail')));

    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'a@b.pl',
        subject: 'S',
        body: 'B',
        trackLinks: false
      }
    ).subscribe(saved => {
      expect(saved).toBeTruthy();     // mimo erroru w logEmailAutoLink
      expect(conv.logEmailAutoLink).toHaveBeenCalled();
      done();
    });

    const sendReq = http.expectOne('/api/mail/send');
    sendReq.flush({ok: true});

    const saveReq = http.expectOne('/api/emails');
    saveReq.flush({id: 'e2', ...saveReq.request.body});
  });

  it('powinien zwrócić błąd jeśli /api/mail/send zwróci błąd', () => {
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_err');

    let error: any = null;
    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'a@b.pl',
        subject: 'S',
        body: 'B',
        trackLinks: false
      }
    ).subscribe({
      next: () => {
      },
      error: (e) => error = e
    });

    const sendReq = http.expectOne('/api/mail/send');
    sendReq.flush({error: 'mail_send_failed'}, {status: 500, statusText: 'Internal'});

    // dalszych requestów już nie ma
    http.expectNone('/api/emails');
    expect(error).toBeTruthy();
  });

  it('nie powinien tagować linków/tracking gdy trackLinks=false', (done) => {
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_plain');

    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'x@y.pl',
        subject: 'S',
        body: 'http://example.com/plain',
        trackLinks: false
      }
    ).subscribe(() => done());

    const sendReq = http.expectOne('/api/mail/send');
    const sendBody = sendReq.request.body as any;
    expect(sendBody.body).toBe('http://example.com/plain'); // bez /api/t?
    sendReq.flush({ok: true});

    const saveReq = http.expectOne('/api/emails');
    const mailPayload = saveReq.request.body as any;
    expect(mailPayload.userId).toBe('u1');
    expect(mailPayload.body).toBe('http://example.com/plain');
    saveReq.flush({id: 'e3', ...mailPayload});
  });
});
