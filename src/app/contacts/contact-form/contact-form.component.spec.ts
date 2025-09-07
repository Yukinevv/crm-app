import {TestBed} from '@angular/core/testing';
import {ContactFormComponent} from './contact-form.component';
import {ReactiveFormsModule} from '@angular/forms';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {of} from 'rxjs';

import {ContactService} from '../contact.service';
import {AuthService} from '../../auth/auth.service';
import {UsersService} from '../../auth/users.service';
import {ConversationService} from '../../email/conversations/conversations.service';

import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getAuth, provideAuth} from '@angular/fire/auth';
import {getFunctions, provideFunctions} from '@angular/fire/functions';

import {Contact} from '../contact.model';

describe('ContactFormComponent (with RouterTestingHarness)', () => {
  let contactServiceSpy: jasmine.SpyObj<ContactService>;
  let usersServiceSpy: jasmine.SpyObj<UsersService>;
  let conversationsSpy: jasmine.SpyObj<ConversationService>;
  let router: Router;

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

  const mockUser = {uid: 'user123', email: 'test@example.com'};

  beforeEach(async () => {
    contactServiceSpy = jasmine.createSpyObj('ContactService', ['getAll', 'getById', 'create', 'update']);
    usersServiceSpy = jasmine.createSpyObj('UsersService', ['getUserByEmail']);
    conversationsSpy = jasmine.createSpyObj('ConversationService', ['list']);

    contactServiceSpy.getAll.and.returnValue(of([mockContact]));
    contactServiceSpy.getById.and.returnValue(of(mockContact));
    // @ts-ignore
    contactServiceSpy.create.and.returnValue(of({}));
    // @ts-ignore
    contactServiceSpy.update.and.returnValue(of({}));

    usersServiceSpy.getUserByEmail.and.returnValue(of({uid: 'u1', email: 'foo@bar.com'}));
    // @ts-ignore
    conversationsSpy.list.and.returnValue(of({items: []}));

    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, ReactiveFormsModule],
      providers: [
        {provide: ContactService, useValue: contactServiceSpy},
        {provide: UsersService, useValue: usersServiceSpy},
        {provide: ConversationService, useValue: conversationsSpy},
        {provide: AuthService, useValue: {user$: of(mockUser)}},

        // Router + trasy używane w testach
        provideRouter([
          {path: 'contacts/:id/edit', component: ContactFormComponent},
          {path: 'contacts', component: ContactFormComponent}
        ]),

        // HttpClient (mock backend)
        provideHttpClient(),
        provideHttpClientTesting(),

        provideFirebaseApp(() => initializeApp({projectId: 'demo', apiKey: 'demo', appId: 'demo'})),
        provideAuth(() => getAuth()),
        provideFunctions(() => getFunctions())
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.stub();
  });

  it('should create via router', async () => {
    const harness = await RouterTestingHarness.create();
    const instance = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);
    expect(instance).toBeTruthy();
  });

  it('should load contact data when editing existing contact (param :id)', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    expect(contactServiceSpy.getById).toHaveBeenCalledWith('1');
    expect(component.form.get('firstName')?.value).toBe(mockContact.firstName);
    expect(component.form.get('lastName')?.value).toBe(mockContact.lastName);
    expect(component.form.get('email')?.value).toBe(mockContact.email);
  });

  it('should initialize form with required fields', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);
    expect(component.form.get('firstName')).toBeTruthy();
    expect(component.form.get('lastName')).toBeTruthy();
    expect(component.form.get('email')).toBeTruthy();
  });

  it('should validate required fields', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    const form = component.form;
    form.controls['firstName'].setValue('');
    form.controls['lastName'].setValue('');
    form.controls['email'].setValue('');

    expect(form.valid).toBeFalse();
    expect(form.controls['firstName'].errors?.['required']).toBeTrue();
    expect(form.controls['lastName'].errors?.['required']).toBeTrue();
    expect(form.controls['email'].errors?.['required']).toBeTrue();
  });

  it('should validate email format', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    const emailControl = component.form.controls['email'];
    emailControl.setValue('invalid-email');
    expect(emailControl.errors?.['email']).toBeTrue();

    emailControl.setValue('valid@email.com');
    expect(emailControl.errors).toBeNull();
  });

  it('should correctly split tags string into array', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    expect(component.tagsSplit('')).toEqual([]);
    expect(component.tagsSplit('single')).toEqual(['single']);
    expect(component.tagsSplit('tag1,tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should submit form and create new contact when valid', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts', ContactFormComponent);

    component.editId = undefined;
    component.form.patchValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com',
      createdAt: '2025-07-14T10:00'
    });

    component.onSubmit();

    expect(contactServiceSpy.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/contacts']);
  });

  it('should update existing contact when in edit mode', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    component.editId = '1';
    component.form.patchValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com',
      createdAt: '2025-07-14T10:00'
    });

    component.onSubmit();

    expect(contactServiceSpy.update).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/contacts']);
  });

  it('should not submit form when invalid', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/contacts/1/edit', ContactFormComponent);

    component.form.controls['email'].setValue('invalid-email');
    component.onSubmit();

    expect(contactServiceSpy.create).not.toHaveBeenCalled();
    expect(contactServiceSpy.update).not.toHaveBeenCalled();
  });
});
