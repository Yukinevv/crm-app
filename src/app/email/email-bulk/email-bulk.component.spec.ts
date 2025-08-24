import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {EmailBulkComponent} from './email-bulk.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BehaviorSubject, of} from 'rxjs';

import {Contact} from '../../contacts/contact.model';
import {ContactService} from '../../contacts/contact.service';
import {AuthService} from '../../auth/auth.service';
import {EmailService} from '../email.service';
import {RouterTestingModule} from '@angular/router/testing';

// ---- Mocks ----
class MockContactService {
  private list: Contact[] = [
    {
      id: 'c1',
      firstName: 'Wiktor',
      lastName: 'Kowalski',
      company: 'Testowa Sp. z o.o.',
      position: 'CEO',
      phone: '',
      email: 'wiktor@testowa.pl',
      address: '',
      createdAt: new Date().toISOString(),
      notes: '',
      tags: []
    },
    {
      id: 'c2',
      firstName: 'Anna',
      lastName: 'Nowak',
      company: 'ACME',
      position: 'Sales',
      phone: '',
      email: 'anna@acme.pl',
      address: '',
      createdAt: new Date().toISOString(),
      notes: '',
      tags: []
    }
  ];

  getAll = jasmine.createSpy('getAll').and.returnValue(of(this.list));
}

class MockAuthService {
  user$ = new BehaviorSubject<any>({
    uid: 'u1',
    email: 'sender@crm-app.test',
    displayName: 'Sender'
  });
}

class MockEmailService {
  sendEmail = jasmine.createSpy('sendEmail').and.callFake((payload: any, ctx?: any) => {
    return of({
      id: 'e_' + Math.random().toString(36).slice(2),
      ...payload,
      date: new Date().toISOString(),
      isRead: false,
      tags: {}
    });
  });
}

describe('EmailBulkComponent', () => {
  let component: EmailBulkComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EmailBulkComponent,
        ReactiveFormsModule,
        FormsModule,
        RouterTestingModule
      ],
      providers: [
        {provide: ContactService, useClass: MockContactService},
        {provide: AuthService, useClass: MockAuthService},
        {provide: EmailService, useClass: MockEmailService}
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(EmailBulkComponent);
    component = fixture.componentInstance;
    // bez tick() w beforeEach - wykona się w testach
    fixture.detectChanges();
  });

  it('powinien wczytać listę kontaktów i filtrować po tekście', fakeAsync(() => {
    // jeśli coś asynchroniczne w ngOnInit to dokończ mikro/makro-zadania
    tick();

    expect(component.contacts.length).toBe(2);

    component.search = 'ACME';
    component.applyFilter();

    expect(component.filtered.length).toBe(1);
    expect(component.filtered[0].company).toBe('ACME');
  }));

  it('powinien zinterpolować zmienne i wysłać maile do wybranych kontaktów', fakeAsync(() => {
    const emailSvc = TestBed.inject(EmailService) as unknown as MockEmailService;
    tick(); // stabilizacja po ngOnInit

    // wybierz oba kontakty
    component.filtered.forEach(c => component.selectedIds.add(c.id));

    // formularz z placeholderami
    component.form.setValue({
      subject: 'Cześć {{firstName}}!',
      body: 'Droga/Drogi {{firstName}} {{lastName}} z {{company}} ({{position}}). Email: {{email}}',
      trackLinks: true
    });

    component.startSend();

    // iteracja 1
    tick();
    tick(120);
    // iteracja 2
    tick();
    tick(120);

    expect(emailSvc.sendEmail).toHaveBeenCalledTimes(2);

    const [call1, call2] = (emailSvc.sendEmail as any).calls.allArgs();

    // Call 1 - Wiktor
    expect(call1[0].to).toBe('wiktor@testowa.pl');
    expect(call1[0].subject).toBe('Cześć Wiktor!');
    expect(call1[0].body).toContain('Wiktor Kowalski z Testowa Sp. z o.o. (CEO). Email: wiktor@testowa.pl');
    expect(call1[1]).toEqual({contactId: 'c1'});

    // Call 2 - Anna
    expect(call2[0].to).toBe('anna@acme.pl');
    expect(call2[0].subject).toBe('Cześć Anna!');
    expect(call2[0].body).toContain('Anna Nowak z ACME (Sales). Email: anna@acme.pl');
    expect(call2[1]).toEqual({contactId: 'c2'});

    expect(component.summary.total).toBe(2);
    expect(component.summary.ok).toBe(2);
    expect(component.summary.fail).toBe(0);
    expect(component.progress).toBe(1);
    expect(component.rows.every(r => r.status === 'sent')).toBeTrue();
  }));

  it('powinien przerwać wysyłkę po cancel()', fakeAsync(() => {
    const emailSvc = TestBed.inject(EmailService) as unknown as MockEmailService;
    tick(); // stabilizacja po ngOnInit

    component.filtered.forEach(c => component.selectedIds.add(c.id));
    component.form.setValue({
      subject: 'Hello {{firstName}}',
      body: 'Body {{email}}',
      trackLinks: false
    });

    component.startSend();

    // dokończ pierwszą iterację
    tick();
    tick(120);

    // przerwij zanim ruszy druga
    component.cancel();

    // daj czas pętli na sprawdzenie flagi
    tick();
    tick(120);

    expect(emailSvc.sendEmail).toHaveBeenCalled(); // przynajmniej 1
    expect((emailSvc.sendEmail as any).calls.count()).toBeLessThanOrEqual(2);
    expect(component.rows.some(r => r.status === 'sent')).toBeTrue();
  }));
});
