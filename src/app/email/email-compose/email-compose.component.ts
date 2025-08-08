import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EmailService} from '../email.service';
import {Router} from '@angular/router';
import {NgForOf, NgIf} from '@angular/common';
import {AuthService} from "../../auth/auth.service";
import {take} from "rxjs";
import {Template} from "../template.model";
import {TemplateService} from "../template.service";

@Component({
  selector: 'app-email-compose',
  templateUrl: './email-compose.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgForOf
  ],
  styleUrls: ['./email-compose.component.scss']
})
export class EmailComposeComponent implements OnInit {
  form: FormGroup;
  sending = false;
  error: string | null = null;

  templates: Template[] = [];
  currentTemplate?: Template;
  placeholderKeys: string[] = [];

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

  private onTemplateSelect(id: string): void {
    if (!id) {
      this.currentTemplate = undefined;
      this.placeholderKeys = [];
      // wyczyść zmienne i pola
      this.form.setControl('variables', this.fb.group({}));
      this.form.patchValue({subject: '', body: ''}, {emitEvent: false});
      return;
    }

    this.templateService.getTemplate(id).subscribe(temp => {
      this.currentTemplate = temp;
      // pobierz unikalne klucze z {{...}}
      const keys = Array.from(new Set([
        ...this.extractKeys(temp.subject),
        ...this.extractKeys(temp.body)
      ]));
      this.placeholderKeys = keys;

      // ustaw pustą grupę dla zmiennych
      const varsGroup: { [key: string]: string } = {};
      keys.forEach(k => varsGroup[k] = '');
      this.form.setControl('variables', this.fb.group(varsGroup));

      // za każdym razem, gdy zmienią się wartości zmiennych, aktualizuj temat i treść
      this.form.get('variables')!.valueChanges.subscribe(() => {
        this.updateFromTemplate();
      });

      // pierwsza inicjalizacja pól
      this.updateFromTemplate();
    });
  }

  /** Zamienia {{klucz}} na wartość wpisaną w formularzu */
  private updateFromTemplate(): void {
    if (!this.currentTemplate) return;

    let subj = this.currentTemplate.subject;
    let body = this.currentTemplate.body;
    const vars = this.form.get('variables')!.value as { [key: string]: string };

    this.placeholderKeys.forEach(key => {
      const val = vars[key] || '';
      const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      subj = subj.replace(re, val);
      body = body.replace(re, val);
    });

    // wpisz zaktualizowane wartości bez wywoływania ponownie valueChanges
    this.form.patchValue({subject: subj, body: body}, {emitEvent: false});
  }

  /** Zwraca wszystkie zmienne z napisu w postaci listy kluczy */
  private extractKeys(text: string): string[] {
    const re = /{{\s*([^{}]+)\s*}}/g;
    const keys: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      keys.push(m[1]);
    }
    return keys;
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
