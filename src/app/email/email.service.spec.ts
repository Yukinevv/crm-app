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
  logEmail = jasmine.createSpy('logEmail').and.returnValue(of({ok: true, conversation: {} as any}));
}

describe('EmailService', () => {
  let service: EmailService;
  let http: HttpTestingController;
  let conv: MockConversationService;

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
  });

  afterEach(() => {
    http.verify();
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
      // conv.logEmail wywołane z contactId
      expect(conv.logEmail).toHaveBeenCalled();
      const payload = conv.logEmail.calls.mostRecent().args[0];
      expect(payload.contactId).toBe('c1');
      expect(payload.direction).toBe('out');
      expect(payload.counterpartEmail).toBe('wiktor@testowa.pl');
      done();
    });

    // 1) wysyłka fizyczna
    const sendReq = http.expectOne('/api/mail/send');
    expect(sendReq.request.method).toBe('POST');
    const sendBody = sendReq.request.body as any;
    expect(sendBody.messageId).toBe('m_test');
    // body powinno być opakowane trackingiem /api/t?m=m_test&u=...
    expect(sendBody.body).toContain('/api/t?');
    expect(sendBody.body).toContain('m=m_test');
    sendReq.flush({ok: true});

    // 2) zapis w skrzynce (json-server)
    const saveReq = http.expectOne('/api/emails');
    expect(saveReq.request.method).toBe('POST');
    const mailPayload = saveReq.request.body as any;
    expect(mailPayload.tags?.utm_content).toBe('m_test');
    expect(mailPayload.body).toContain('/api/t?'); // dalej z trackingiem
    saveReq.flush({
      id: 'e1',
      ...mailPayload
    });
  });

  it('powinien przeżyć błąd logowania konwersacji (mail zapisany OK)', (done) => {
    spyOn<any>(service as any, 'generateMessageId').and.returnValue('m_x');
    // symuluj błąd logEmail
    conv.logEmail.and.returnValue(throwError(() => new Error('fail')));

    service.sendEmail(
      {
        from: 'sender@crm-app.test',
        to: 'a@b.pl',
        subject: 'S',
        body: 'B',
        trackLinks: false
      }
    ).subscribe(saved => {
      expect(saved).toBeTruthy();     // mimo erroru w logEmail
      expect(conv.logEmail).toHaveBeenCalled();
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
    expect(mailPayload.body).toBe('http://example.com/plain');
    saveReq.flush({id: 'e3', ...mailPayload});
  });
});
