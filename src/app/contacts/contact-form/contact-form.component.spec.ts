import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ContactFormComponent} from './contact-form.component';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ContactService} from '../contact.service';
import {AuthService} from '../../auth/auth.service';
import {of} from 'rxjs';
import {Contact} from '../contact.model';

describe('ContactFormComponent', () => {
  let component: ContactFormComponent;
  let fixture: ComponentFixture<ContactFormComponent>;
  let contactServiceSpy: jasmine.SpyObj<ContactService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockContact: Contact = {
    id: '1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: 'jan@example.com',
    company: 'Firma XYZ',
    phone: '123456789',
    position: 'Manager',
    address: 'ul. Testowa 1',
    notes: 'Notatka testowa',
    tags: ['tag1', 'tag2'],
    status: 'active',
    createdAt: '2025-07-14T10:00:00',
    source: 'web',
    region: 'Polska',
    userId: 'user123',
    companyId: 'comp1',
    managerId: 'manager1',
    decisionMakerId: 'decision1'
  };

  const mockUser = {
    uid: 'user123',
    email: 'test@example.com'
  };

  beforeEach(async () => {
    contactServiceSpy = jasmine.createSpyObj('ContactService', ['getAll', 'getById', 'create', 'update']);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      user$: of(mockUser)
    });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    contactServiceSpy.getAll.and.returnValue(of([mockContact]));
    contactServiceSpy.getById.and.returnValue(of(mockContact));
    // @ts-ignore
    contactServiceSpy.create.and.returnValue(of({}));
    // @ts-ignore
    contactServiceSpy.update.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        {provide: ContactService, useValue: contactServiceSpy},
        {provide: AuthService, useValue: authServiceSpy},
        {provide: Router, useValue: routerSpy},
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(new Map([['id', '1']]))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with all required fields', () => {
    expect(component.form.get('firstName')).toBeTruthy();
    expect(component.form.get('lastName')).toBeTruthy();
    expect(component.form.get('email')).toBeTruthy();
  });

  it('should load contact data when editing existing contact', fakeAsync(() => {
    component.ngOnInit();
    tick();

    expect(contactServiceSpy.getById).toHaveBeenCalledWith('1');
    expect(component.form.get('firstName')?.value).toBe(mockContact.firstName);
    expect(component.form.get('lastName')?.value).toBe(mockContact.lastName);
    expect(component.form.get('email')?.value).toBe(mockContact.email);
  }));

  it('should validate required fields', () => {
    const form = component.form;
    form.controls['firstName'].setValue('');
    form.controls['lastName'].setValue('');
    form.controls['email'].setValue('');

    expect(form.valid).toBeFalsy();
    expect(form.controls['firstName'].errors?.['required']).toBeTruthy();
    expect(form.controls['lastName'].errors?.['required']).toBeTruthy();
    expect(form.controls['email'].errors?.['required']).toBeTruthy();
  });

  it('should validate email format', () => {
    const emailControl = component.form.controls['email'];

    emailControl.setValue('invalid-email');
    expect(emailControl.errors?.['email']).toBeTruthy();

    emailControl.setValue('valid@email.com');
    expect(emailControl.errors).toBeFalsy();
  });

  it('should correctly split tags string into array', () => {
    expect(component.tagsSplit('')).toEqual([]);
    expect(component.tagsSplit('single')).toEqual(['single']);
    expect(component.tagsSplit('tag1,tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should submit form and create new contact when valid', fakeAsync(() => {
    component.editId = undefined;
    component.form.patchValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com'
    });

    component.onSubmit();
    tick();

    expect(contactServiceSpy.create).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/contacts']);
  }));

  it('should update existing contact when in edit mode', fakeAsync(() => {
    component.editId = '1';
    component.form.patchValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com'
    });

    component.onSubmit();
    tick();

    expect(contactServiceSpy.update).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/contacts']);
  }));

  it('should not submit form when invalid', fakeAsync(() => {
    component.form.controls['email'].setValue('invalid-email');
    component.onSubmit();
    tick();

    expect(contactServiceSpy.create).not.toHaveBeenCalled();
    expect(contactServiceSpy.update).not.toHaveBeenCalled();
  }));
});
