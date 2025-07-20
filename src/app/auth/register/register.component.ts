import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Router, RouterLink} from '@angular/router';
import {CommonModule} from '@angular/common';
import {AuthErrorCodes} from 'firebase/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  form: FormGroup;
  error: string | null = null;

  constructor(
    fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required]
    }, {validators: this.matchPasswords});
  }

  private matchPasswords(fg: FormGroup) {
    return fg.get('password')!.value === fg.get('confirm')!.value
      ? null : {mismatch: true};
  }

  onSubmit() {
    if (this.form.invalid) return;
    const {email, password} = this.form.value;
    this.error = null;
    this.auth.register(email, password)
      .then(() => this.router.navigate(['/contacts']))
      .catch(err => {
        this.error = this.getErrorMessage(err);
      });
  }

  private getErrorMessage(err: any): string {
    switch (err.code) {
      case AuthErrorCodes.EMAIL_EXISTS:
        return 'Podany email jest już zarejestrowany';
      case AuthErrorCodes.INVALID_EMAIL:
        return 'Nieprawidłowy format adresu email';
      case AuthErrorCodes.WEAK_PASSWORD:
        return 'Hasło jest zbyt słabe (min. 6 znaków)';
      default:
        return 'Wystąpił błąd podczas rejestracji';
    }
  }
}
