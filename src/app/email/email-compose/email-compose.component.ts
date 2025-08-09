import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EmailService} from '../email.service';
import {Router} from '@angular/router';
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
  styleUrls: ['./email-compose.component.scss']
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
      private auth: AuthService
  ) {
    this.form = this.fb.group({
      templateId: [''],
      to: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      body: ['', Validators.required],
      variables: this.fb.group({})
    });
  }

  ngOnInit(): void {
    // Pobierz listę szablonów
    this.templateService.getTemplates().subscribe(list => {
      this.templates = list;
    });

    // Gdy użytkownik wybierze szablon
    this.form.get('templateId')?.valueChanges.subscribe(id => {
      this.onTemplateSelect(id);
    });
  }

  ngOnDestroy(): void {
    this.varsSub?.unsubscribe();
  }

  private onTemplateSelect(id: string): void {
    // wyczyść poprzednią subskrypcję zmiennych
    this.varsSub?.unsubscribe();

    if (!id) {
      this.currentTemplate = undefined;
      this.placeholderKeys = [];
      this.variableTypes = {};
      this.form.setControl('variables', this.fb.group({}));
      this.form.patchValue({subject: '', body: ''}, {emitEvent: false});
      return;
    }

    this.templateService.getTemplate(id).subscribe(temp => {
      this.currentTemplate = temp;

      // wykryj klucze zmiennych z subject + body
      const keys = Array.from(new Set([
        ...this.extractKeys(temp.subject),
        ...this.extractKeys(temp.body)
      ]));

      this.placeholderKeys = keys;

      // zmapuj nazwy zmiennych na typy pól
      this.variableTypes = {};
      keys.forEach(k => (this.variableTypes[k] = this.detectType(k)));

      // zbuduj grupę formularza dla zmiennych
      const varsGroup: Record<string, any> = {};
      keys.forEach(k => (varsGroup[k] = ''));
      this.form.setControl('variables', this.fb.group(varsGroup));

      // dynamiczna aktualizacja subject/body przy zmianach zmiennych
      this.varsSub = this.form.get('variables')!.valueChanges.subscribe(() => {
        this.updateFromTemplate();
      });

      // inicjalne podstawienie
      this.updateFromTemplate();
    });
  }

  /** Zamienia {{klucz}} na wartości z formularza, formatując date/time po polsku */
  private updateFromTemplate(): void {
    if (!this.currentTemplate) return;

    let subj = this.currentTemplate.subject;
    let body = this.currentTemplate.body;
    const vars = this.form.get('variables')!.value as Record<string, string>;

    this.placeholderKeys.forEach(key => {
      const type = this.variableTypes[key];
      let val = vars[key] || '';

      if (type === 'date' && val) {
        val = this.formatDatePL(val); // 'YYYY-MM-DD' -> np. 'sobota, 9 sierpnia 2025'
      } else if (type === 'time' && val) {
        val = this.formatTime(val);   // 'HH:mm' -> 'HH:mm'
      }

      const re = new RegExp(`{{\\s*${this.escapeRegExp(key)}\\s*}}`, 'g');
      subj = subj.replace(re, val);
      body = body.replace(re, val);
    });

    this.form.patchValue({subject: subj, body: body}, {emitEvent: false});
  }

  /** Proste wykrywanie typu pola po nazwie zmiennej */
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
    // Unikamy strefy czasowej: parsujemy ręcznie 'YYYY-MM-DD'
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
    // Zakładamy format 'HH:mm'
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
      const {to, subject, body} = this.form.value;

      this.emailService.sendEmail({from: fromEmail, to, subject, body})
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
