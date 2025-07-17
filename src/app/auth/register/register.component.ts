import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Router, RouterLink} from '@angular/router';
import {CommonModule} from '@angular/common';

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
    this.auth.register(email, password)
      .then(() => this.router.navigate(['/contacts']))
      .catch((err: { message: string | null; }) => this.error = err.message);
  }
}
