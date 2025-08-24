import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EmailService} from '../email.service';
import {ActivatedRoute, Router} from '@angular/router';
import {NgForOf, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault} from '@angular/common';
import {AuthService} from "../../auth/auth.service";
import {distinctUntilChanged, Subscription, take} from "rxjs";
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

  // Subskrypcje
  private varsSub?: Subscription;
  private subjSub?: Subscription;
  private bodySub?: Subscription;

  // Flagi auto-sync z szablonu
  syncSubject = true;
  syncBody = true;

  // Flaga by odróżniać zmiany programistyczne od użytkownika
  private programmaticPatching = 0;

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
    // Prefill z query params (np. odpowiedź)
    const qp = this.route.snapshot.queryParamMap;
    const to = qp.get('to') || '';
    const subject = qp.get('subject') || '';
    const body = qp.get('body') || '';
    if (to || subject || body) {
      this.patchProgrammatically(() => this.form.patchValue({to, subject, body}, {emitEvent: true}));
      // skoro user przyszedł z Reply, domyślnie nie nadpisuj tego z szablonu
      if (subject) this.syncSubject = false;
      if (body) this.syncBody = false;
    }

    // Pobierz szablony
    this.templateService.getTemplates().subscribe(list => {
      this.templates = list;
    });

    // Reakcja na wybór szablonu
    this.form.get('templateId')?.valueChanges.subscribe(id => {
      this.onTemplateSelect(id);
    });

    // Jeśli użytkownik ręcznie zmieni temat/treść to wyłącz auto-sync
    const subjCtrl = this.form.get('subject')!;
    const bodyCtrl = this.form.get('body')!;

    this.subjSub = subjCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        if (!this.isProgrammatic()) this.syncSubject = false;
      });

    this.bodySub = bodyCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        if (!this.isProgrammatic()) this.syncBody = false;
      });
  }

  ngOnDestroy(): void {
    this.varsSub?.unsubscribe();
    this.subjSub?.unsubscribe();
    this.bodySub?.unsubscribe();
  }

  // ====== Obsługa wyboru szablonu ======
  private onTemplateSelect(id: string): void {
    // wyczyść poprzednią subskrypcję zmiennych
    this.varsSub?.unsubscribe();

    if (!id) {
      this.currentTemplate = undefined;
      this.placeholderKeys = [];
      this.variableTypes = {};
      this.patchProgrammatically(() => this.form.setControl('variables', this.fb.group({})));
      return;
    }

    this.templateService.getTemplate(id).subscribe(temp => {
      this.currentTemplate = temp;

      // wykryj klucze zmiennych z subject oraz body
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
      this.patchProgrammatically(() => this.form.setControl('variables', this.fb.group(varsGroup)));

      // dynamiczna aktualizacja subject/body przy zmianach zmiennych
      this.varsSub = this.form.get('variables')!.valueChanges.subscribe(() => {
        this.updateFromTemplate(); // uwzględnia syncSubject/syncBody
      });

      // Pierwsze podstawienie - tylko jeśli sync włączony
      this.updateFromTemplate();
    });
  }

  /** Zbuduj teksty z szablonu + zmiennych (nie zapisuje jeszcze do form) */
  private buildFromTemplate(): { subject: string; body: string } {
    if (!this.currentTemplate) {
      return {subject: this.form.get('subject')?.value || '', body: this.form.get('body')?.value || ''};
    }

    let subj = this.currentTemplate.subject;
    let body = this.currentTemplate.body;
    const vars = this.form.get('variables')!.value as Record<string, string>;

    this.placeholderKeys.forEach(key => {
      const type = this.variableTypes[key];
      let val = vars[key] || '';

      if (type === 'date' && val) {
        val = this.formatDatePL(val); // 'YYYY-MM-DD' -> 'sobota, 9 sierpnia 2025'
      } else if (type === 'time' && val) {
        val = this.formatTime(val);   // 'HH:mm'
      }

      const re = new RegExp(`{{\\s*${this.escapeRegExp(key)}\\s*}}`, 'g');
      subj = subj.replace(re, val);
      body = body.replace(re, val);
    });

    return {subject: subj, body};
  }

  /** Aktualizuje pola z szablonu tylko gdy włączone syncSubject/syncBody */
  private updateFromTemplate(): void {
    const result = this.buildFromTemplate();
    const subjCtrl = this.form.get('subject')!;
    const bodyCtrl = this.form.get('body')!;

    this.patchProgrammatically(() => {
      if (this.syncSubject) subjCtrl.setValue(result.subject, {emitEvent: true});
      if (this.syncBody) bodyCtrl.setValue(result.body, {emitEvent: true});
    });
  }

  // ====== Publiczne akcje z UI ======

  /** Ręczne zastosowanie szablonu teraz (nie zmienia stanu „sync”) */
  applyTemplateNow(field: 'subject' | 'body' | 'both' = 'both'): void {
    const result = this.buildFromTemplate();
    this.patchProgrammatically(() => {
      if (field === 'subject' || field === 'both') {
        this.form.get('subject')!.setValue(result.subject, {emitEvent: true});
      }
      if (field === 'body' || field === 'both') {
        this.form.get('body')!.setValue(result.body, {emitEvent: true});
      }
    });
  }

  /** Zmiana przełączników „Aktualizuj z szablonu” */
  onToggleSync(field: 'subject' | 'body', checked: boolean): void {
    if (field === 'subject') {
      this.syncSubject = checked;
    } else {
      this.syncBody = checked;
    }
    // Jeśli użytkownik włączył sync to od razu nadpisujemy bieżącą wartość z szablonu
    if (checked) {
      if (field === 'subject') this.applyTemplateNow('subject');
      if (field === 'body') this.applyTemplateNow('body');
    }
  }

  // ====== Wysyłka / Anuluj ======
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

  // ====== Utils ======

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

  private patchProgrammatically(fn: () => void): void {
    this.programmaticPatching++;
    try {
      fn();
    } finally {
      this.programmaticPatching--;
    }
  }

  private isProgrammatic(): boolean {
    return this.programmaticPatching > 0;
  }
}
