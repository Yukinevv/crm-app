import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {DatePipe, NgIf} from '@angular/common';
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

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

  bodyHtml: SafeHtml | null = null;

  constructor(
      private route: ActivatedRoute,
      private emailService: EmailService,
      private router: Router,
      private sanitizer: DomSanitizer
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.emailService.getEmail(id).subscribe({
        next: data => {
          this.email = data;
          this.bodyHtml = this.renderBodyHtml(data.body || '');
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

  // --- render ---

  private renderBodyHtml(plain: string): SafeHtml {
    // escapujemy HTML
    const safeText = this.escapeHtml(plain);

    // linkifikujemy http(s)://
    const withLinks = safeText.replace(
        /\bhttps?:\/\/[^\s<>"']+/gi,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );

    // zachowujemy nowe linie
    const withBreaks = withLinks.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(withBreaks);
  }

  private escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }
}
