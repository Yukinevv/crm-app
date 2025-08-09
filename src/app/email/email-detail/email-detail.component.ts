import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {DatePipe, NgIf} from '@angular/common';

@Component({
  selector: 'app-email-detail',
  templateUrl: './email-detail.component.html',
  imports: [
    DatePipe,
    NgIf
  ],
  styleUrls: ['./email-detail.component.scss']
})
export class EmailDetailComponent implements OnInit {
  email?: Email;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private emailService: EmailService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.emailService.getEmail(id).subscribe({
        next: data => {
          this.email = data;
          this.loading = false;
        },
        error: () => {
          this.error = 'Nie można wczytać wiadomości';
          this.loading = false;
        }
      });
    } else {
      this.error = 'Nie wybrano wiadomości';
      this.loading = false;
    }
  }

  back(): void {
    this.router.navigate(['/email']);
  }
}
