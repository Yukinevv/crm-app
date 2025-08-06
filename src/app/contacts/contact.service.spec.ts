import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {ContactService} from './contact.service';
import {AuthService} from '../auth/auth.service';
import {BehaviorSubject} from 'rxjs';
import {Contact} from './contact.model';

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

describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;
  let authService: MockAuthService;
  const baseUrl = '/api/contacts';

  beforeEach(() => {
    authService = new MockAuthService();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ContactService,
        {provide: AuthService, useValue: authService}
      ]
    });

    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() should return empty array when user is null', done => {
    authService.setUser(null);

    service.getAll().subscribe(contacts => {
      expect(contacts).toEqual([]);
      done();
    });
  });

  it('getAll() should GET contacts for logged-in user', done => {
    const user = {uid: 'u1'};
    authService.setUser(user);

    const sample: Contact[] = [
      {
        id: 'c1', userId: 'u1', firstName: 'A', lastName: 'B',
        company: '', position: '', phone: '', email: 'a@b',
        address: '', createdAt: '', tags: [], source: '',
        region: '', notes: '', status: '', managerId: undefined,
        decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
      }
    ];

    service.getAll().subscribe(contacts => {
      expect(contacts).toEqual(sample);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}?userId=u1`);
    expect(req.request.method).toBe('GET');
    req.flush(sample);
  });

  it('getById() should fetch a contact when logged in', done => {
    const user = {uid: 'u2'};
    authService.setUser(user);

    const contact: Contact = {
      id: 'c2', userId: 'u2', firstName: 'X', lastName: 'Y',
      company: '', position: '', phone: '', email: 'x@y',
      address: '', createdAt: '', tags: [], source: '',
      region: '', notes: '', status: '', managerId: undefined,
      decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
    };

    service.getById('c2').subscribe(res => {
      expect(res).toEqual(contact);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/c2`);
    expect(req.request.method).toBe('GET');
    req.flush(contact);
  });

  it('getById() should error when user is null', done => {
    authService.setUser(null);

    service.getById('c3').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('create() should POST a contact with userId when logged in', done => {
    const user = {uid: 'u3'};
    authService.setUser(user);

    const payload: Omit<Contact, 'id'> = {
      firstName: 'New', lastName: 'Contact', company: '', position: '', phone: '',
      email: 'new@c', address: '', createdAt: '', tags: [], source: '',
      region: '', notes: '', status: '', managerId: undefined,
      decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
    };
    const returned: Contact = {id: 'nc1', userId: 'u3', ...payload};

    service.create(payload).subscribe(res => {
      expect(res).toEqual(returned);
      done();
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({...payload, userId: 'u3'});
    req.flush(returned);
  });

  it('create() should error when user is null', done => {
    authService.setUser(null);

    const payload: Omit<Contact, 'id'> = {
      firstName: '', lastName: '', company: '', position: '', phone: '',
      email: '', address: '', createdAt: '', tags: [], source: '',
      region: '', notes: '', status: '', managerId: undefined,
      decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
    };

    service.create(payload).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('update() should PUT a contact when logged in', done => {
    const user = {uid: 'u4'};
    authService.setUser(user);

    const contact: Contact = {
      id: 'c4', userId: 'u4', firstName: 'Up', lastName: 'Date',
      company: '', position: '', phone: '', email: 'u@d',
      address: '', createdAt: '', tags: [], source: '',
      region: '', notes: '', status: '', managerId: undefined,
      decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
    };

    service.update(contact).subscribe(res => {
      expect(res).toEqual(contact);
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/c4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(contact);
    req.flush(contact);
  });

  it('update() should error when user is null', done => {
    authService.setUser(null);

    const contact: Contact = {
      id: 'c5', userId: '', firstName: '', lastName: '',
      company: '', position: '', phone: '', email: '',
      address: '', createdAt: '', tags: [], source: '',
      region: '', notes: '', status: '', managerId: undefined,
      decisionMakerId: undefined, linkedUid: undefined, companyId: undefined
    };

    service.update(contact).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });

  it('delete() should DELETE a contact when logged in', done => {
    const user = {uid: 'u6'};
    authService.setUser(user);

    service.delete('c6').subscribe(res => {
      expect(res).toBeNull();
      done();
    });

    const req = httpMock.expectOne(`${baseUrl}/c6`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('delete() should error when user is null', done => {
    authService.setUser(null);

    service.delete('c7').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        expect(err.message).toBe('Nieautoryzowany');
        done();
      }
    });
  });
});
