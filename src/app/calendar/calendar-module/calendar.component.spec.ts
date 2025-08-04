import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {CalendarComponent} from './calendar.component';
import {EventService} from '../event.service';
import {AuthService} from '../../auth/auth.service';
import {Router} from '@angular/router';
import {of} from 'rxjs';
import {CalendarEvent} from '../calendar-event.model';
import {FullCalendarModule} from '@fullcalendar/angular';
import {DateSelectArg, EventClickArg, EventContentArg} from '@fullcalendar/core';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  let mockEventService: jasmine.SpyObj<EventService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockUser = {uid: 'user123', email: 'a@b.com'};
  const sampleEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'E1',
      start: '2025-08-10T10:00:00',
      end: '2025-08-10T11:00:00',
      allDay: false,
      userId: 'user123',
      creatorName: 'Me',
      participants: []
    },
    {
      id: '2',
      title: 'E2',
      start: '2025-08-11T12:00:00',
      end: '2025-08-11T13:00:00',
      allDay: false,
      participants: []
    }
  ];

  beforeEach(() => {
    mockEventService = jasmine.createSpyObj('EventService', ['getAll']);
    mockAuthService = jasmine.createSpyObj('AuthService', [], {user$: of(mockUser as any)});
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockEventService.getAll.and.returnValue(of(sampleEvents));

    TestBed.configureTestingModule({
      imports: [
        FullCalendarModule,
        CalendarComponent  // standalone, importujemy
      ],
      providers: [
        {provide: EventService, useValue: mockEventService},
        {provide: AuthService, useValue: mockAuthService},
        {provide: Router, useValue: mockRouter},
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
  });

  it('powinien utworzyć komponent i zainicjalizować calendarOptions', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.calendarOptions.initialView).toBe('dayGridMonth');
    // @ts-ignore
    expect(component.calendarOptions.plugins.length).toBe(3);
    expect(component.calendarOptions.selectable).toBeTrue();
    expect(component.calendarOptions.events).toEqual([]);
  });

  it('ngOnInit powinien pobrać użytkownika i załadować eventy', fakeAsync(() => {
    // wywołujemy ngOnInit przez change detection
    fixture.detectChanges();
    // flush promise z firstValueFrom + wszelkie microtasks
    tick();
    // teraz serwis powinien być wywołany
    expect(mockEventService.getAll).toHaveBeenCalled();

    const loaded = component.calendarOptions.events as any[];
    expect(loaded.length).toBe(2);
    // pierwszy event: userId === currentUserUid => creatorName "Ty"
    expect(loaded[0].extendedProps.creatorName).toBe('Ty');
    // drugi event nie ma userId => brak extendedProps
    expect(loaded[1].extendedProps).toBeUndefined();
  }));

  it('renderEventContent powinien zwrócić poprawne węzły DOM', () => {
    fixture.detectChanges();

    const fakeArg: EventContentArg = {
      event: {
        title: 'Test',
        extendedProps: {creatorName: 'Jan'},
        id: 'x',
        start: '',
        end: '',
        allDay: false,
        backgroundColor: '',
        borderColor: '',
        classNames: [],
        htmlClass: '',
        overlap: true,
        publicId: '',
        url: '',
        source: null,
        constraint: null,
        editable: true,
        startEditable: true,
        durationEditable: true,
        resourceEditable: true,
        rendering: '',
        overlapGroup: '',
        uiDisplay: '',
      } as any,
      isMirror: false,
      view: null!,
      timeText: '',
      backgroundColor: '',
      borderColor: '',
      textColor: '',
      isDraggable: false,
      isStartResizable: false,
      isEndResizable: false,
      isStart: false,
      isEnd: false,
      isPast: false,
      isFuture: false,
      isToday: false,
      isSelected: false,
      isDragging: false,
      isResizing: false
    };

    const res = component['renderEventContent'](fakeArg);
    const texts = res.domNodes.map(n => n.innerText);
    expect(texts).toContain('Test');
    expect(texts).toContain('Utworzył: Jan');
  });

  it('handleDateSelect powinien nawigować do nowego spotkania z query params', () => {
    fixture.detectChanges();

    const arg: DateSelectArg = {
      start: new Date('2025-08-15T08:00:00'),
      end: new Date('2025-08-15T09:00:00'),
      startStr: '2025-08-15T08:00:00',
      endStr: '2025-08-15T09:00:00',
      allDay: false,
      jsEvent: null!,
      view: null!
    };
    component['handleDateSelect'](arg);
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/calendar/new'],
      {queryParams: {start: '2025-08-15T08:00:00', end: '2025-08-15T09:00:00', allDay: false}}
    );
  });

  it('handleEventClick powinien nawigować do edycji wydarzenia', () => {
    fixture.detectChanges();

    const fakeEvent: EventClickArg = {
      event: {id: '42'} as any,
      el: null!,
      jsEvent: null!,
      view: null!
    };
    component['handleEventClick'](fakeEvent);
    expect(mockRouter.navigate).toHaveBeenCalledWith([`/calendar/42/edit`]);
  });
});
