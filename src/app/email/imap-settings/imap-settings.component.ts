import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {NgForOf, NgIf} from '@angular/common';
import {RouterLink} from '@angular/router';
import {ImapConfigDto, ImapConfigView, ImapSettingsService} from '../imap-settings.service';

@Component({
  selector: 'app-imap-settings',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, RouterLink, NgForOf],
  templateUrl: './imap-settings.component.html',
  styleUrls: ['./imap-settings.component.scss']
})
export class ImapSettingsComponent implements OnInit {
  form!: FormGroup;
  loading = true;
  saving = false;
  testing = false;
  error: string | null = null;
  testResult: { ok: true; mailboxes: string[]; sample?: { id: string; subject: string }[] } | null = null;

  hasPasswordOnServer = false;

  constructor(private fb: FormBuilder, private svc: ImapSettingsService) {
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      host: ['', Validators.required],
      port: [993, [Validators.required, Validators.min(1)]],
      secure: [true],
      user: ['', Validators.required],
      pass: [''],
      mailbox: ['INBOX', Validators.required]
    });

    this.svc.get().subscribe({
      next: (cfg: ImapConfigView | null) => {
        if (cfg) {
          this.form.patchValue({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            user: cfg.user,
            mailbox: cfg.mailbox || 'INBOX'
          }, {emitEvent: false});
          this.hasPasswordOnServer = !!cfg.hasPassword;
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Nie udało się pobrać konfiguracji';
        this.loading = false;
      }
    });
  }

  private buildDto(includePass = true): ImapConfigDto {
    const v = this.form.value;
    const dto: ImapConfigDto = {
      host: v.host,
      port: Number(v.port),
      secure: !!v.secure,
      user: v.user,
      mailbox: v.mailbox || 'INBOX'
    };
    if (includePass && v.pass) dto.pass = v.pass;
    return dto;
  }

  test(): void {
    if (this.form.invalid) return;
    this.error = null;
    this.testResult = null;
    this.testing = true;

    this.svc.test(this.buildDto(!!this.form.value.pass)).subscribe({
      next: (r) => {
        this.testResult = r;
        this.testing = false;
      },
      error: () => {
        this.error = 'Test połączenia nieudany';
        this.testing = false;
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.error = null;
    this.saving = true;

    this.svc.save(this.buildDto(true)).subscribe({
      next: () => {
        this.saving = false;
        this.hasPasswordOnServer = this.hasPasswordOnServer || !!this.form.value.pass;
        this.form.get('pass')?.reset();
        alert('Zapisano konfigurację IMAP');
      },
      error: () => {
        this.error = 'Nie udało się zapisać konfiguracji';
        this.saving = false;
      }
    });
  }
}
