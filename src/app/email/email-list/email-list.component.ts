import {Component, OnInit} from '@angular/core';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {Router, RouterLink} from '@angular/router';
import {DatePipe, NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-email-list',
  templateUrl: './email-list.component.html',
  imports: [
    NgIf,
    NgForOf,
    DatePipe,
    RouterLink
  ],
  styleUrls: ['./email-list.component.scss']
})
export class EmailListComponent implements OnInit {
  emails: Email[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private emailService: EmailService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.loadEmails();
  }

  loadEmails(): void {
    this.emailService.getEmails().subscribe({
      next: data => {
        this.emails = data.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        this.loading = false;
      },
      error: () => {
        this.error = 'Błąd ładowania wiadomości';
        this.loading = false;
      }
    });
  }

  openEmail(email: Email): void {
    this.emailService.markAsRead(email.id).subscribe(() => {
      this.router.navigate(['/email/read', email.id]);
    });
  }

  compose(): void {
    this.router.navigate(['/email/compose']);
  }
}
