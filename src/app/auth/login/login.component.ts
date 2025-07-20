import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Router, RouterLink} from '@angular/router';
import {CommonModule} from '@angular/common';
import {AuthErrorCodes} from "firebase/auth";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  form: FormGroup;
  error: string | null = null;

  constructor(
      fb: FormBuilder,
      private auth: AuthService,
      private router: Router
  ) {
    this.form = fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const {email, password} = this.form.value;
    this.error = null;
    this.auth.login(email, password)
        .then(() => this.router.navigate(['/contacts']))
        .catch(err => {
          this.error = this.getErrorMessage(err);
        });
  }

  private getErrorMessage(err: any): string {
    switch (err.code) {
      case AuthErrorCodes.INVALID_EMAIL:
        return 'Nieprawidłowy format adresu email';
      case AuthErrorCodes.USER_DELETED:
        return 'Użytkownik o podanym adresie nie istnieje';
      case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
        return 'Nieprawidłowe hasło';
      case AuthErrorCodes.USER_DISABLED:
        return 'Konto zostało zablokowane';
      case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
        return 'Zbyt wiele prób logowania. Spróbuj ponownie później';
      default:
        return 'Wystąpił błąd podczas logowania';
    }
  }
}
