import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EmailService} from '../email.service';
import {ActivatedRoute, Router} from '@angular/router';
import {NgForOf, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault} from '@angular/common';
import {AuthService} from "../../auth/auth.service";
import {Subscription, take} from "rxjs";
import {Template} from "../template.model";
import {TemplateService} from "../template.service";

type VarType = 'text' | 'date' | 'time';

@Component({
  selector: 'app-email-compose',
  templateUrl: './email-compose.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgForOf,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault
  ],
  styleUrls: ['./email-compose.component.scss'],
  standalone: true
})
export class EmailComposeComponent implements OnInit, OnDestroy {
  form: FormGroup;
  sending = false;
  error: string | null = null;

  templates: Template[] = [];
  currentTemplate?: Template;

  placeholderKeys: string[] = [];
  variableTypes: Record<string, VarType> = {};

  private varsSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private emailService: EmailService,
    private templateService: TemplateService,
    private router: Router,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      templateId: [''],
      to: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      body: ['', Validators.required],
      trackLinks: [true],
      variables: this.fb.group({})
    });
  }

  ngOnInit(): void {
    // Prefill z query params (np. odpowiedź z Odebranych)
    const qp = this.route.snapshot.queryParamMap;
    const to = qp.get('to') || '';
    const subject = qp.get('subject') || '';
    const body = qp.get('body') || '';
    if (to || subject || body) {
      this.form.patchValue({to, subject, body});
    }

    // Pobierz szablony
    this.templateService.getTemplates().subscribe(list => {
      this.templates = list;
    });

    // Reakcja na wybór szablonu
    this.form.get('templateId')?.valueChanges.subscribe(id => {
      this.onTemplateSelect(id);
    });
  }

  ngOnDestroy(): void {
    this.varsSub?.unsubscribe();
  }

  private onTemplateSelect(id: string): void {
    this.varsSub?.unsubscribe();

    if (!id) {
      this.currentTemplate = undefined;
      this.placeholderKeys = [];
      this.variableTypes = {};
      this.form.setControl('variables', this.fb.group({}));
      // UWAGA: jeśli pola były prefilled z query params – nie nadpisujemy ich
      return;
    }

    this.templateService.getTemplate(id).subscribe(temp => {
      this.currentTemplate = temp;

      const keys = Array.from(new Set([
        ...this.extractKeys(temp.subject),
        ...this.extractKeys(temp.body)
      ]));

      this.placeholderKeys = keys;
      this.variableTypes = {};
      keys.forEach(k => (this.variableTypes[k] = this.detectType(k)));

      const varsGroup: Record<string, any> = {};
      keys.forEach(k => (varsGroup[k] = ''));
      this.form.setControl('variables', this.fb.group(varsGroup));

      this.varsSub = this.form.get('variables')!.valueChanges.subscribe(() => {
        this.updateFromTemplate();
      });

      // inicjalne podstawienie do subject/body tylko gdy puste (nie nadpisuj prefill)
      const subjEmpty = !this.form.get('subject')?.value;
      const bodyEmpty = !this.form.get('body')?.value;
      if (subjEmpty || bodyEmpty) {
        const prev = {subj: this.form.value.subject, body: this.form.value.body};
        this.updateFromTemplate();
        // jeśli któreś było wypełnione – zachowaj użytkownika
        this.form.patchValue({
          subject: subjEmpty ? this.form.value.subject : prev.subj,
          body: bodyEmpty ? this.form.value.body : prev.body
        }, {emitEvent: false});
      }
    });
  }

  private updateFromTemplate(): void {
    if (!this.currentTemplate) return;

    let subj = this.currentTemplate.subject;
    let body = this.currentTemplate.body;
    const vars = this.form.get('variables')!.value as Record<string, string>;

    this.placeholderKeys.forEach(key => {
      const type = this.variableTypes[key];
      let val = vars[key] || '';

      if (type === 'date' && val) {
        val = this.formatDatePL(val);
      } else if (type === 'time' && val) {
        val = this.formatTime(val);
      }

      const re = new RegExp(`{{\\s*${this.escapeRegExp(key)}\\s*}}`, 'g');
      subj = subj.replace(re, val);
      body = body.replace(re, val);
    });

    this.form.patchValue({subject: subj, body: body}, {emitEvent: false});
  }

  private detectType(key: string): VarType {
    const k = key.trim().toLowerCase();
    if (['data', 'date', 'termin', 'dzień', 'dzien', 'day'].includes(k)) return 'date';
    if (['godzina', 'czas', 'time', 'hour'].includes(k)) return 'time';
    return 'text';
  }

  private extractKeys(text: string): string[] {
    const re = /{{\s*([^{}]+?)\s*}}/g;
    const keys: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      keys.push(m[1]);
    }
    return keys;
  }

  private formatDatePL(yyyyMmDd: string): string {
    const [y, m, d] = yyyyMmDd.split('-').map(n => parseInt(n, 10));
    if (!y || !m || !d) return yyyyMmDd;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(hhmm: string): string {
    return hhmm;
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  send(): void {
    if (this.form.invalid) return;
    this.sending = true;
    this.error = null;

    this.auth.user$.pipe(take(1)).subscribe(user => {
      const fromEmail = user?.email ?? '';
      const {to, subject, body, trackLinks} = this.form.value;

      this.emailService.sendEmail({from: fromEmail, to, subject, body, trackLinks})
        .subscribe({
          next: () => this.router.navigate(['/email']),
          error: () => {
            this.error = 'Błąd wysyłki wiadomości';
            this.sending = false;
          }
        });
    });
  }

  cancel(): void {
    this.router.navigate(['/email']);
  }
}
