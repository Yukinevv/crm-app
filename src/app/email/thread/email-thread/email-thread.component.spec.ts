import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';

import {EmailThreadComponent} from './email-thread.component';
import {Conversation} from '../../conversations/conversations.model';
import {ConversationService} from '../../conversations/conversations.service';
import {EmailService} from '../../email.service';
import {ContactService} from '../../../contacts/contact.service';
import {Email} from '../../email.model';

describe('EmailThreadComponent', () => {
  let conv: jasmine.SpyObj<ConversationService>;
  let emails: jasmine.SpyObj<EmailService>;
  let contacts: jasmine.SpyObj<ContactService>;

  const routeWithQuery = (qp: Record<string, string>) => ({
    queryParamMap: of(convertToParamMap(qp)),
    snapshot: {queryParamMap: convertToParamMap(qp)}
  });

  beforeEach(async () => {
    conv = jasmine.createSpyObj<ConversationService>('ConversationService', ['list']);
    emails = jasmine.createSpyObj<EmailService>('EmailService', ['getEmail']);
    contacts = jasmine.createSpyObj<ContactService>('ContactService', ['getById']);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, EmailThreadComponent],
      providers: [
        {provide: ConversationService, useValue: conv},
        {provide: EmailService, useValue: emails},
        {provide: ContactService, useValue: contacts},
        // domyślnie brak parametrów - testy będą nadpisywać
        {provide: ActivatedRoute, useValue: routeWithQuery({})},
      ]
    }).compileComponents();
  });

  function setQueryParams(qp: Record<string, string>) {
    TestBed.overrideProvider(ActivatedRoute, {useValue: routeWithQuery(qp)});
  }

  // ZMIANA: domyślne preview = '' (a nie 'P')
  function sampleConv(
    id: string,
    direction: 'in' | 'out',
    dateIso: string,
    emailId: string,
    subj = 'S',
    preview: string | undefined = ''
  ): Conversation {
    return {
      id,
      userId: 'u1',
      type: 'email',
      direction,
      subject: subj,
      preview: preview as any,
      date: dateIso,
      emailId,
      contactId: undefined,
      leadId: undefined,
      counterpartEmail: 'x@y.z'
    };
  }

  it('ngOnInit: z contactId – tytuł z kontaktu, conv.list z contactId, sortowanie rosnąco po dacie', () => {
    setQueryParams({contactId: 'c1'});

    contacts.getById.and.returnValue(of({
      id: 'c1',
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@x.pl'
    } as any));

    const unsorted: Conversation[] = [
      sampleConv('1', 'out', '2024-01-02T10:00:00Z', 'e1', 'S1'),
      sampleConv('2', 'in', '2024-01-01T10:00:00Z', 'e2', 'S2'),
      sampleConv('3', 'out', '2024-01-03T10:00:00Z', 'e3', 'S3'),
    ];
    conv.list.and.returnValue(of(unsorted));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(conv.list).toHaveBeenCalledWith({
      contactId: 'c1',
      leadId: undefined,
      counterpartEmail: undefined,
      limit: 1000
    });

    expect(contacts.getById).toHaveBeenCalledWith('c1');
    expect(comp.title).toBe('Wątek: Jan Kowalski – jan@x.pl');

    expect(comp.items.map(i => i.id)).toEqual(['2', '1', '3']);

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBeNull();
  });

  it('ngOnInit: z email (bez kontaktu) – tytuł z adresu, conv.list z counterpartEmail', () => {
    setQueryParams({email: 'client@foo.com'});

    conv.list.and.returnValue(of([]));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(contacts.getById).not.toHaveBeenCalled();
    expect(conv.list).toHaveBeenCalledWith({
      contactId: undefined,
      leadId: undefined,
      counterpartEmail: 'client@foo.com',
      limit: 1000
    });
    expect(comp.title).toBe('Wątek: client@foo.com');
  });

  it('ngOnInit: błąd conv.list -> error i loading=false', () => {
    setQueryParams({email: 'x@y.z'});

    conv.list.and.returnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Nie udało się pobrać wątku');
  });

  it('ngOnInit: błąd getById dla contactId -> tytuł fallback', () => {
    setQueryParams({contactId: 'cX'});

    contacts.getById.and.returnValue(throwError(() => new Error('404')));
    conv.list.and.returnValue(of([]));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.title).toBe('Wątek korespondencji');
  });

  it('toggle(): pierwszy raz – pobiera treść maila, cache’uje i rozwija', () => {
    setQueryParams({email: 'a@b.c'});

    const item = sampleConv('1', 'out', '2024-01-02T10:00:00Z', 'e42', 'Temat', 'Prev');
    conv.list.and.returnValue(of([item]));

    const mail: Email = {
      id: 'e42',
      from: 'me@acme.pl',
      to: 'client@x.pl',
      subject: 'Temat',
      body: 'Pełna treść',
      date: '2024-01-02T10:00:00Z',
      isRead: true,
      messageId: 'm-e42'
    } as any;

    emails.getEmail.and.returnValue(of(mail));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.isExpanded('e42')).toBeFalse();

    comp.toggle(item);

    expect(emails.getEmail).toHaveBeenCalledWith('e42');
    expect(comp.isExpanded('e42')).toBeTrue();
    expect(comp.getEmailBody(item)).toBe('Pełna treść');
  });

  it('toggle(): błąd pobrania – i tak rozwija, pokazuje preview', () => {
    setQueryParams({email: 'a@b.c'});

    const item = sampleConv('1', 'in', '2024-01-02T10:00:00Z', 'e99', 'Temat', 'Podgląd');
    conv.list.and.returnValue(of([item]));
    emails.getEmail.and.returnValue(throwError(() => new Error('nope')));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.toggle(item);

    expect(emails.getEmail).toHaveBeenCalledWith('e99');
    expect(comp.isExpanded('e99')).toBeTrue();
    expect(comp.getEmailBody(item)).toBe('Podgląd');
  });

  it('toggle(): drugi raz – zwija', () => {
    setQueryParams({email: 'a@b.c'});

    const item = sampleConv('1', 'out', '2024-01-02T10:00:00Z', 'e1', 'S', 'P');
    conv.list.and.returnValue(of([item]));
    emails.getEmail.and.returnValue(of({id: 'e1', body: 'B'} as any));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.toggle(item); // expand
    expect(comp.isExpanded('e1')).toBeTrue();

    comp.toggle(item); // collapse
    expect(comp.isExpanded('e1')).toBeFalse();
  });

  it('getEmailBody(): zwraca body z cache jeśli jest, inaczej preview, inaczej pusty string', () => {
    setQueryParams({email: 'a@b.c'});

    const a = sampleConv('1', 'out', '2024-01-01T10:00:00Z', 'ea', 'Sa', 'Pa');
    const b = sampleConv('2', 'in', '2024-01-02T10:00:00Z', 'eb', 'Sb', undefined as any);
    conv.list.and.returnValue(of([a, b]));

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // brak w cache -> preview
    expect(comp.getEmailBody(a)).toBe('Pa');

    // brak preview i cache -> ''
    expect(comp.getEmailBody(b)).toBe('');

    // dodaj do cache
    comp['emailCache'].set('ea', {id: 'ea', body: 'Body-A'} as any);
    expect(comp.getEmailBody(a)).toBe('Body-A');
  });

  it('back(): nawigacja do /email/conversations', () => {
    setQueryParams({email: 'x@y.z'});
    conv.list.and.returnValue(of([]));

    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(EmailThreadComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.back();

    expect(navSpy).toHaveBeenCalledWith(['/email/conversations']);
  });
});
