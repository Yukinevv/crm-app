// src/app/calendar/event-form/event-form.component.spec.ts

import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {EventFormComponent} from './event-form.component';
import {AuthService} from '../../auth/auth.service';
import {EventService} from '../event.service';
import {ContactService} from '../../contacts/contact.service';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {of} from 'rxjs';
import {Contact} from '../../contacts/contact.model';
import {CalendarEvent} from '../calendar-event.model';

describe('EventFormComponent (nowe wydarzenie)', () => {
  let component: EventFormComponent;
  let fixture: ComponentFixture<EventFormComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockEventService: jasmine.SpyObj<EventService>;
  let mockContactService: jasmine.SpyObj<ContactService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const sampleContacts: Contact[] = [
    {
      id: 'c1',
      firstName: 'John',
      lastName: 'Doe',
      company: '',
      position: '',
      phone: '',
      email: 'john@doe',
      address: '',
      notes: '',
      tags: [],
      status: '',
      createdAt: '',
      source: '',
      region: '',
      managerId: undefined,
      decisionMakerId: undefined,
      linkedUid: undefined,
    }
  ];

  const mockUser = {
    uid: 'user1',
    email: 'user1@example.com',
    displayName: 'User One'
  };

  beforeEach(fakeAsync(() => {
    // Zamockowane serwisy
    mockAuthService = jasmine.createSpyObj('AuthService', [], {user$: of(mockUser as any)});
    mockEventService = jasmine.createSpyObj('EventService', ['create', 'update']);
    mockContactService = jasmine.createSpyObj('ContactService', ['getAll', 'create']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    // KontaktService zwraca sampleContacts
    mockContactService.getAll.and.returnValue(of(sampleContacts));

    TestBed.configureTestingModule({
      imports: [
        EventFormComponent  // standalone component
      ],
      providers: [
        {provide: AuthService, useValue: mockAuthService},
        {provide: EventService, useValue: mockEventService},
        {provide: ContactService, useValue: mockContactService},
        {
          provide: ActivatedRoute,
          useValue: {
            // brak paramMap.get('id') => tworzymy nowe wydarzenie
            paramMap: of(convertToParamMap({})),
            // queryParams z start/end/allDay
            queryParams: of({start: '2025-08-20', end: '2025-08-21', allDay: 'false'})
          }
        },
        {provide: Router, useValue: mockRouter}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EventFormComponent);
    component = fixture.componentInstance;
  }));

  it('powinien utworzyć komponent z loading = true', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeTrue();
  });

  it('ngOnInit ładuje kontakty i ustawia formularz na "nowe wydarzenie"', fakeAsync(() => {
    fixture.detectChanges(); // wywołuje ngOnInit
    tick();                  // flushuje await z toPromise()

    // contactsList
    expect(component.contactsList).toEqual(sampleContacts);
    // isCreator = true (nowe wydarzenie)
    expect(component.isCreator).toBeTrue();
    // loading = false
    expect(component.loading).toBeFalse();

    // form.patchValue dla start/end/allDay
    expect(component.form.get('start')!.value).toBe('2025-08-20T00:00');
    expect(component.form.get('end')!.value).toBe('2025-08-21T00:00');
    expect(component.form.get('allDay')!.value).toBeFalse();
  }));

  it('onParticipantSelect dodaje nowego uczestnika', () => {
    // początkowo brak uczestników
    component.form.get('participants')!.setValue([]);
    const fakeEvent = {target: {value: 'c1'}} as any;
    component.onParticipantSelect(fakeEvent);
    expect(component.selectedParticipants).toEqual(['c1']);
  });

  it('removeParticipant usuwa uczestnika', () => {
    component.form.get('participants')!.setValue(['c1', 'c2']);
    component.removeParticipant('c1');
    expect(component.selectedParticipants).toEqual(['c2']);
  });

  it('getContactName zwraca pełne imię i nazwisko lub "—" gdy brak', () => {
    component.contactsList = sampleContacts;
    expect(component.getContactName('c1')).toBe('John Doe');
    expect(component.getContactName('unknown')).toBe('—');
  });

  it('onSubmit wywołuje create i nawigację gdy formularz jest poprawny', fakeAsync(() => {
    fixture.detectChanges();
    tick();  // dokończ ngOnInit

    // ustawiamy tytuł, aby formularz stał się valid
    component.form.get('title')!.setValue('Spotkanie testowe');

    mockEventService.create.and.returnValue(of({} as CalendarEvent));
    component.onSubmit();

    // create powinno być wywołane
    expect(mockEventService.create).toHaveBeenCalled();
    tick(); // flush subskrypcję
    // nawigacja do listy
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/calendar']);
  }));
});
