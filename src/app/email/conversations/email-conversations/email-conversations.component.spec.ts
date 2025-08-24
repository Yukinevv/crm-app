// email-conversations.component.spec.ts
import {TestBed} from '@angular/core/testing';
import {EmailConversationsComponent} from './email-conversations.component';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';
import {ContactService} from '../../../contacts/contact.service';
import {ConversationService} from '../conversations.service';
import {Conversation} from '../conversations.model';
import {AuthService} from '../../../auth/auth.service';

// ---- Mocks ----
class MockContactService {
  getAll = jasmine.createSpy('getAll').and.returnValue(
    of([
      {
        id: 'c1',
        firstName: 'Wiktor',
        lastName: 'Kowalski',
        company: 'ACME',
        position: 'CEO',
        phone: '',
        email: 'wiktor@acme.com',
        address: '',
        notes: '',
        tags: [],
        status: '',
        createdAt: new Date().toISOString(),
        source: '',
        region: ''
      }
    ])
  );
}

class MockConversationService {
  list = jasmine.createSpy('list').and.returnValue(
    of<Conversation[]>([
      {
        id: 'v1',
        userId: 'u1',
        type: 'email',
        direction: 'out',
        subject: 'Oferta',
        preview: 'W załączniku oferta…',
        date: new Date('2025-01-05T10:00:00Z').toISOString(),
        emailId: 'e1',
        contactId: 'c1',
        counterpartEmail: 'wiktor@acme.com'
      },
      {
        id: 'v2',
        userId: 'u1',
        type: 'email',
        direction: 'in',
        subject: 'Re: Oferta',
        preview: 'Dziękuję za wiadomość…',
        date: new Date('2025-01-06T09:00:00Z').toISOString(),
        emailId: 'e2',
        leadId: 'l1',
        counterpartEmail: 'lead@example.com'
      }
    ])
  );
}

// Minimalny mock AuthService – tylko to, czego komponent (pośrednio) potrzebuje.
const mockAuthService: Partial<AuthService> = {
  // nie jest używany w samym komponencie, ale wstrzyknięcie musi się powieść
  user$: of({uid: 'u-TEST', email: 'me@test.local'} as any)
};

describe('EmailConversationsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailConversationsComponent, RouterTestingModule],
      providers: [
        {provide: ContactService, useClass: MockContactService},
        {provide: ConversationService, useClass: MockConversationService},
        // podstawiamy AuthService mockiem, żeby nie tworzyć prawdziwego @angular/fire Auth
        {provide: AuthService, useValue: mockAuthService}
      ]
    }).compileComponents();
  });

  it('powinien załadować kontakty i konwersacje oraz filtrować po kierunku', () => {
    const fixture = TestBed.createComponent(EmailConversationsComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges(); // ngOnInit

    expect(comp.contactName.get('c1')).toBe('Wiktor Kowalski');
    expect(comp.conversations.length).toBe(2);

    comp.filterDirection = 'all';
    expect(comp.filtered.length).toBe(2);

    comp.filterDirection = 'out';
    expect(comp.filtered.length).toBe(1);
    expect(comp.filtered[0].direction).toBe('out');

    comp.filterDirection = 'in';
    expect(comp.filtered.length).toBe(1);
    expect(comp.filtered[0].direction).toBe('in');
  });

  it('nameFor() – kontakt po contactId, lead fallback na e-mail, w innym razie "—"', () => {
    const fixture = TestBed.createComponent(EmailConversationsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const [c1, c2] = comp.conversations;

    expect(comp.nameFor(c1)).toBe('Wiktor Kowalski');
    expect(comp.nameFor(c2)).toBe('lead@example.com');

    expect(
      comp.nameFor({
        id: 'x',
        userId: 'u',
        type: 'email',
        direction: 'out',
        subject: 'S',
        date: new Date().toISOString(),
        emailId: 'e',
        counterpartEmail: ''
      })
    ).toBe('—');
  });

  it('threadParams() – poprawne queryParams', () => {
    const fixture = TestBed.createComponent(EmailConversationsComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const [c1, c2] = comp.conversations;

    expect(comp.threadParams(c1)).toEqual({contactId: 'c1'});
    expect(comp.threadParams(c2)).toEqual({leadId: 'l1'});
    expect(
      comp.threadParams({
        id: 'v3',
        userId: 'u1',
        type: 'email',
        direction: 'out',
        subject: 'X',
        date: new Date().toISOString(),
        emailId: 'e3',
        counterpartEmail: 'x@y.z'
      })
    ).toEqual({email: 'x@y.z'});
  });

  it('refresh() – wywołuje list z parametrem q', () => {
    const fixture = TestBed.createComponent(EmailConversationsComponent);
    const comp = fixture.componentInstance;
    const svc = TestBed.inject(ConversationService) as unknown as MockConversationService;

    fixture.detectChanges();

    comp.q = 'oferta';
    comp.refresh();

    expect(svc.list).toHaveBeenCalledWith({q: 'oferta', limit: 500});
  });

  it('obsługa błędu – ustawia error i loading=false', () => {
    const svc = TestBed.inject(ConversationService) as unknown as MockConversationService;
    (svc.list as any).and.returnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(EmailConversationsComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Nie udało się pobrać logów');
  });
});
