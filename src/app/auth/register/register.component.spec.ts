import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {RegisterComponent} from './register.component';
import {ReactiveFormsModule} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {AuthErrorCodes} from 'firebase/auth';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['register']);

    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        ReactiveFormsModule,
        RouterTestingModule.withRoutes([])
      ],
      providers: [
        {provide: AuthService, useValue: authSpy}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.detectChanges();
  });

  it('powinien utworzyć komponent', () => {
    expect(component).toBeTruthy();
  });

  it('powinien zainicjalizować formularz z pustymi polami', () => {
    expect(component.form.get('email')!.value).toBe('');
    expect(component.form.get('password')!.value).toBe('');
    expect(component.form.get('confirm')!.value).toBe('');
  });

  it('powinien oznaczyć formularz jako nieprawidłowy dla pustych pól', () => {
    expect(component.form.valid).toBeFalse();
    expect(component.form.get('email')!.hasError('required')).toBeTrue();
    expect(component.form.get('password')!.hasError('required')).toBeTrue();
    expect(component.form.get('confirm')!.hasError('required')).toBeTrue();
  });

  it('powinien oznaczyć email jako nieprawidłowy dla złego formatu', () => {
    const email = component.form.get('email')!;
    email.setValue('invalid-email');
    expect(email.hasError('email')).toBeTrue();
  });

  it('powinien wymagać minLength 6 dla hasła', () => {
    const pwd = component.form.get('password')!;
    pwd.setValue('123');
    expect(pwd.hasError('minlength')).toBeTrue();
  });

  it('powinien oznaczyć mismatch gdy hasła się nie zgadzają', () => {
    component.form.get('password')!.setValue('haslo123');
    component.form.get('confirm')!.setValue('inneHaslo');
    // wywołaj manualnie walidację grupy
    component.form.updateValueAndValidity();
    expect(component.form.hasError('mismatch')).toBeTrue();
  });

  it('powinien oznaczyć formularz jako prawidłowy dla zgodnych, poprawnych danych', () => {
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });
    expect(component.form.valid).toBeTrue();
  });

  it('nie powinien wywołać register dla nieprawidłowego formularza', () => {
    component.onSubmit();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('powinien przekierować na /contacts po udanej rejestracji', fakeAsync(() => {
    // @ts-ignore
    authService.register.and.returnValue(Promise.resolve());
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });

    component.onSubmit();
    tick();

    expect(authService.register).toHaveBeenCalledWith('test@example.com', 'haslo123');
    expect(router.navigate).toHaveBeenCalledWith(['/contacts']);
    expect(component.error).toBeNull();
  }));

  it('powinien ustawić komunikat dla EMAIL_EXISTS', fakeAsync(() => {
    authService.register.and.returnValue(Promise.reject({code: AuthErrorCodes.EMAIL_EXISTS}));
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });

    component.onSubmit();
    tick();

    expect(component.error).toBe('Podany email jest już zarejestrowany');
  }));

  it('powinien ustawić komunikat dla INVALID_EMAIL', fakeAsync(() => {
    authService.register.and.returnValue(Promise.reject({code: AuthErrorCodes.INVALID_EMAIL}));
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });

    component.onSubmit();
    tick();

    expect(component.error).toBe('Nieprawidłowy format adresu email');
  }));

  it('powinien ustawić komunikat dla WEAK_PASSWORD', fakeAsync(() => {
    authService.register.and.returnValue(Promise.reject({code: AuthErrorCodes.WEAK_PASSWORD}));
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });

    component.onSubmit();
    tick();

    expect(component.error).toBe('Hasło jest zbyt słabe (min. 6 znaków)');
  }));

  it('powinien ustawić domyślny komunikat dla nieznanego błędu', fakeAsync(() => {
    authService.register.and.returnValue(Promise.reject({code: 'UNKNOWN'}));
    component.form.setValue({
      email: 'test@example.com',
      password: 'haslo123',
      confirm: 'haslo123'
    });

    component.onSubmit();
    tick();

    expect(component.error).toBe('Wystąpił błąd podczas rejestracji');
  }));
});
