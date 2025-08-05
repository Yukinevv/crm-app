import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {EventService} from './event.service';
import {AuthService} from '../auth/auth.service';
import {BehaviorSubject} from 'rxjs';
import {CalendarEvent, CreateEvent, ParticipantSnapshot, UpdateEvent} from './calendar-event.model';

interface MockUser {
  uid: string;
  email?: string;
}

class MockAuthService {
  private userSubject = new BehaviorSubject<MockUser | null>(null);
  user$ = this.userSubject.asObservable();

  setUser(user: MockUser | null) {
    this.userSubject.next(user);
  }
}

describe('EventService', () => {
  let service: EventService;
  let httpMock: HttpTestingController;
  let authService: MockAuthService;
  const baseUrl = '/api/events';

  beforeEach(() => {
    authService = new MockAuthService();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        EventService,
        {provide: AuthService, useValue: authService}
      ]
    });

    service = TestBed.inject(EventService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() should return empty array when user is null', done => {
    authService.setUser(null);

    service.getAll().subscribe(events => {
      expect(events).toEqual([]);
      done();
    });
  });

  it('getAll() should filter events correctly for logged-in user', done => {
    const user = {uid: 'u1'};
    authService.setUser(user);

    const allEvents: CalendarEvent[] = [
      {id: 'e1', title: 'No userId', participants: [], start: '', end: '', allDay: false},
      {id: 'e2', title: 'Own event', userId: 'u1', participants: [], start: '', end: '', allDay: false},
      {id: 'e3', title: 'Other user event', userId: 'u2', participants: [], start: '', end: '', allDay: false},
      {
        id: 'e4',
        title: 'Invited',
        userId: 'u2',
        invitedUserIds: ['u1'],
        participants: [],
        start: '',
        end: '',
        allDay: false
      },
      {
        id: 'e5',
        title: 'Not invited',
        userId: 'u2',
        invitedUserIds: ['u3'],
        participants: [],
        start: '',
        end: '',
        allDay: false
      }
    ];

    service.getAll().subscribe(events => {
      const ids = events.map(e => e.id).sort();
      expect(ids).toEqual(['e1', 'e2', 'e4']);
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(allEvents);
  });

  it('getGlobal() should return all events', done => {
    const sample: CalendarEvent[] = [
      {id: 'g1', title: 'Global1', participants: [], start: '', end: '', allDay: false}
    ];

    service.getGlobal().subscribe(events => {
      expect(events).toEqual(sample);
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(sample);
  });

  it('getById() should fetch event by id', done => {
    const evt: CalendarEvent = {id: 'x1', title: 'ById', participants: [], start: '', end: '', allDay: false};

    service.getById('x1').subscribe(res => {
      expect(res).toEqual(evt);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/x1`);
    expect(req.request.method).toBe('GET');
    req.flush(evt);
  });

  it('create() should POST event with userId when logged in', done => {
    const user = {uid: 'u9'};
    authService.setUser(user);

    const payload: CreateEvent = {
      title: 'New',
      participants: [],
      invitedUserIds: [],
      creatorName: 'Me',
      participantsSnapshot: [] as ParticipantSnapshot[],
      location: '',
      virtualLink: '',
      start: '2025-08-01T10:00:00Z',
      end: '2025-08-01T11:00:00Z',
      allDay: false,
      reminderMinutesBefore: 0
    };
    const returned: CalendarEvent = {...payload, id: 'new1', userId: 'u9'};

    service.create(payload).subscribe(res => {
      expect(res).toEqual(returned);
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({...payload, userId: 'u9'});
    req.flush(returned);
  });

  it('create() should error when user is null', done => {
    authService.setUser(null);

    const payload: CreateEvent = {
      title: 'NoUser',
      participants: [],
      invitedUserIds: [],
      creatorName: '',
      participantsSnapshot: [],
      location: '',
      virtualLink: '',
      start: '',
      end: '',
      allDay: false,
      reminderMinutesBefore: 0
    };

    service.create(payload).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('update() should PUT event with userId when logged in', done => {
    const user = {uid: 'u7'};
    authService.setUser(user);

    const updateEvt: UpdateEvent = {
      id: 'up1',
      title: 'Upd',
      participants: [],
      invitedUserIds: [],
      creatorName: 'Me',
      participantsSnapshot: [] as ParticipantSnapshot[],
      location: '',
      virtualLink: '',
      start: '',
      end: '',
      allDay: false,
      reminderMinutesBefore: 0
    };
    const returned: CalendarEvent = {...updateEvt, userId: 'u7'};

    service.update(updateEvt).subscribe(res => {
      expect(res).toEqual(returned);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/up1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({...updateEvt, userId: 'u7'});
    req.flush(returned);
  });

  it('update() should error when user is null', done => {
    authService.setUser(null);
    const updateEvt: UpdateEvent = {
      id: 'fail1',
      title: '',
      participants: [],
      invitedUserIds: [],
      creatorName: '',
      participantsSnapshot: [],
      location: '',
      virtualLink: '',
      start: '',
      end: '',
      allDay: false,
      reminderMinutesBefore: 0
    };

    service.update(updateEvt).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('delete() should DELETE event when logged in', done => {
    const user = {uid: 'u5'};
    authService.setUser(user);

    service.delete('d1').subscribe(res => {
      expect(res).toBeNull();
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/d1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('delete() should error when user is null', done => {
    authService.setUser(null);

    service.delete('d2').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('leaveEvent() should PATCH event with given data', done => {
    const participants = ['p1'];
    const invitedUserIds = ['u1'];
    const snapshot: ParticipantSnapshot[] = [{uid: 'u1', name: 'A', email: 'a@x'}];
    const returned: CalendarEvent = {
      id: 'l1',
      title: 'Leave',
      participants,
      invitedUserIds,
      participantsSnapshot: snapshot,
      start: '',
      end: '',
      allDay: false
    };

    service.leaveEvent('l1', participants, invitedUserIds, snapshot).subscribe(res => {
      expect(res).toEqual(returned);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/l1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({participants, invitedUserIds, participantsSnapshot: snapshot});
    req.flush(returned);
  });
});
