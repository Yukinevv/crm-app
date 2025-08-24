import {TestBed} from '@angular/core/testing';
import {ConversationService, LogEmailPayload} from './conversations.service';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {BehaviorSubject, of} from 'rxjs';
import {AuthService} from '../../auth/auth.service';
import {ContactService} from '../../contacts/contact.service';
import {Conversation} from './conversations.model';

class MockAuthService {
  user$ = new BehaviorSubject<any>({
    uid: 'u-123',
    email: 'me@example.com',
    displayName: 'Me'
  });
}

class MockContactService {
  // znajdzie kontakt po e-mailu
  resolveByEmail = jasmine.createSpy('resolveByEmail').and.callFake((email: string) => {
    if (email.toLowerCase() === 'john@acme.com') {
      return of({id: 'c-1'} as any);
    }
    return of(undefined);
  });
}

describe('ConversationService', () => {
  let service: ConversationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ConversationService,
        {provide: AuthService, useClass: MockAuthService},
        {provide: ContactService, useClass: MockContactService}
      ]
    });

    service = TestBed.inject(ConversationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() – wysyła GET z userId + parametrami i mapuje items', () => {
    const mockItems: Conversation[] = [
      {
        id: 'conv1',
        userId: 'u-123',
        type: 'email',
        direction: 'out',
        subject: 'Hello',
        date: new Date().toISOString(),
        emailId: 'e1',
        counterpartEmail: 'john@acme.com'
      }
    ];

    let result: Conversation[] | undefined;
    service.list({q: 'hello', limit: 500}).subscribe(r => (result = r));

    const req = httpMock.expectOne((r) =>
      r.method === 'GET' &&
      r.url === '/api/conversations' &&
      r.params.get('userId') === 'u-123' &&
      r.params.get('q') === 'hello' &&
      r.params.get('limit') === '500'
    );
    expect(req).toBeTruthy();

    req.flush({items: mockItems});

    expect(result).toEqual(mockItems);
  });

  it('logEmail() – POST /api/conversations/logEmail zwraca conversation', () => {
    const payload: LogEmailPayload = {
      userId: 'u-123',
      direction: 'out',
      subject: 'S',
      body: 'B',
      emailId: 'e-1',
      counterpartEmail: 'john@acme.com',
      date: new Date().toISOString()
    };

    let ok = false;
    let returned: Conversation | undefined;

    service.logEmail(payload).subscribe((resp) => {
      ok = resp.ok;
      returned = resp.conversation;
    });

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/conversations/logEmail'
    );
    expect(req.request.body).toEqual(payload);

    const conv: Conversation = {
      id: 'conv-1',
      userId: 'u-123',
      type: 'email',
      direction: 'out',
      subject: 'S',
      preview: 'B',
      date: payload.date!,
      emailId: 'e-1',
      counterpartEmail: 'john@acme.com',
      contactId: 'c-1'
    };

    req.flush({ok: true, conversation: conv});

    expect(ok).toBeTrue();
    expect(returned).toEqual(conv);
  });

  it('logEmailAutoLink() – znajduje kontakt po e-mailu i dołącza contactId', () => {
    let returned: Conversation | undefined;

    service
      .logEmailAutoLink({
        userId: '', // zostanie uzupełnione z Auth
        direction: 'in',
        subject: 'Hey',
        body: 'Body',
        emailId: 'e-2',
        counterpartEmail: 'john@acme.com',
        date: new Date().toISOString()
      })
      .subscribe((r) => (returned = r.conversation));

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/conversations/logEmail'
    );

    // powinien dołączyć userId z Auth oraz contactId z resolveByEmail()
    expect(req.request.body.userId).toBe('u-123');
    expect(req.request.body.contactId).toBe('c-1');

    const conv: Conversation = {
      id: 'conv-2',
      userId: 'u-123',
      type: 'email',
      direction: 'in',
      subject: 'Hey',
      preview: 'Body',
      date: new Date().toISOString(),
      emailId: 'e-2',
      counterpartEmail: 'john@acme.com',
      contactId: 'c-1'
    };
    req.flush({ok: true, conversation: conv});

    expect(returned).toEqual(conv);
  });

  it('logEmailAutoLink() – gdy kontakt nie istnieje, POST bez contactId', () => {
    let returned: Conversation | undefined;

    service
      .logEmailAutoLink({
        userId: '',
        direction: 'in',
        subject: 'No contact',
        body: 'X',
        emailId: 'e-3',
        counterpartEmail: 'unknown@domain.com',
        date: new Date().toISOString()
      })
      .subscribe((r) => (returned = r.conversation));

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/conversations/logEmail'
    );

    expect(req.request.body.userId).toBe('u-123');
    expect(req.request.body.contactId).toBeUndefined();

    const conv: Conversation = {
      id: 'conv-3',
      userId: 'u-123',
      type: 'email',
      direction: 'in',
      subject: 'No contact',
      preview: 'X',
      date: new Date().toISOString(),
      emailId: 'e-3',
      counterpartEmail: 'unknown@domain.com'
    };
    req.flush({ok: true, conversation: conv});

    expect(returned).toEqual(conv);
  });
});
