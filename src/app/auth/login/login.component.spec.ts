import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {LoginComponent} from './login.component';
import {ReactiveFormsModule} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {AuthErrorCodes} from 'firebase/auth';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        ReactiveFormsModule,
        RouterTestingModule.withRoutes([])
      ],
      providers: [
        {provide: AuthService, useValue: authSpy}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
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
    expect(component.form.get('email')?.value).toBe('');
    expect(component.form.get('password')?.value).toBe('');
  });

  it('powinien oznaczyć formularz jako nieprawidłowy dla pustych pól', () => {
    expect(component.form.valid).toBeFalse();
    expect(component.form.get('email')?.hasError('required')).toBeTrue();
    expect(component.form.get('password')?.hasError('required')).toBeTrue();
  });

  it('powinien oznaczyć email jako nieprawidłowy dla złego formatu', () => {
    const emailControl = component.form.get('email')!;
    emailControl.setValue('nieprawidlowy-email');
    expect(emailControl.hasError('email')).toBeTrue();
  });

  it('powinien oznaczyć formularz jako prawidłowy dla poprawnych danych', () => {
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});
    expect(component.form.valid).toBeTrue();
  });

  it('nie powinien wywołać logowania dla nieprawidłowego formularza', () => {
    component.form.setValue({email: '', password: ''});
    component.onSubmit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('powinien przekierować na /contacts po udanym logowaniu', fakeAsync(() => {
    // @ts-ignore
    authService.login.and.returnValue(Promise.resolve());
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});

    component.onSubmit();
    tick();  // czekamy na zakończenie promise

    expect(authService.login).toHaveBeenCalledWith('test@example.com', 'haslo123');
    expect(router.navigate).toHaveBeenCalledWith(['/contacts']);
    expect(component.error).toBeNull();
  }));

  it('powinien ustawić odpowiedni komunikat błędu dla nieprawidłowego emaila', fakeAsync(() => {
    authService.login.and.returnValue(Promise.reject({code: AuthErrorCodes.INVALID_EMAIL}));
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});

    component.onSubmit();
    tick();

    expect(component.error).toBe('Nieprawidłowy format adresu email');
  }));

  it('powinien ustawić odpowiedni komunikat błędu dla nieistniejącego użytkownika', fakeAsync(() => {
    authService.login.and.returnValue(Promise.reject({code: AuthErrorCodes.USER_DELETED}));
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});

    component.onSubmit();
    tick();

    expect(component.error).toBe('Użytkownik o podanym adresie nie istnieje');
  }));

  it('powinien ustawić odpowiedni komunikat błędu dla nieprawidłowego hasła', fakeAsync(() => {
    authService.login.and.returnValue(Promise.reject({code: AuthErrorCodes.INVALID_LOGIN_CREDENTIALS}));
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});

    component.onSubmit();
    tick();

    expect(component.error).toBe('Nieprawidłowe hasło');
  }));

  it('powinien ustawić domyślny komunikat błędu dla nieobsługiwanego kodu błędu', fakeAsync(() => {
    authService.login.and.returnValue(Promise.reject({code: 'UNKNOWN_ERROR'}));
    component.form.setValue({email: 'test@example.com', password: 'haslo123'});

    component.onSubmit();
    tick();

    expect(component.error).toBe('Wystąpił błąd podczas logowania');
  }));
});
