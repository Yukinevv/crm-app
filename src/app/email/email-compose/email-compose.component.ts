import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EmailService} from '../email.service';
import {Router} from '@angular/router';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-email-compose',
  templateUrl: './email-compose.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf
  ],
  styleUrls: ['./email-compose.component.scss']
})
export class EmailComposeComponent {
  form: FormGroup;
  sending = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private emailService: EmailService,
    private router: Router
  ) {
    this.form = this.fb.group({
      to: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      body: ['', Validators.required]
    });
  }

  send(): void {
    if (this.form.invalid) return;
    this.sending = true;
    this.error = null;
    const {to, subject, body} = this.form.value;
    this.emailService.sendEmail({from: 'me@example.com', to, subject, body})
      .subscribe({
        next: () => this.router.navigate(['/email']),
        error: () => {
          this.error = 'Błąd wysyłki wiadomości';
          this.sending = false;
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/email']);
  }
}
