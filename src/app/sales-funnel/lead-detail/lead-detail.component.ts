import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {CommonModule, NgForOf} from '@angular/common';
import {combineLatest, Observable, of} from 'rxjs';
import {distinctUntilChanged, switchMap, tap} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';

import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {Lead} from '../lead.model';
import {User} from 'firebase/auth';
import {AuthService} from '../../auth/auth.service';

@Component({
  selector: 'app-lead-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgForOf,
    RouterLink
  ],
  templateUrl: './lead-detail.component.html',
  styleUrls: ['./lead-detail.component.scss']
})
export class LeadDetailComponent implements OnInit {
  form!: FormGroup;
  stages: Stage[] = [];
  isEdit = false;
  leadId?: string;
  user$: Observable<User | null>;

  dynamicFieldsConfig: {
    [stageName: string]: {
      controlName: string;
      label: string;
      type: string;
      validators?: any[];
    }[];
  } = {
    Oferta: [
      {controlName: 'offerAmount', label: 'Kwota oferty', type: 'number', validators: [Validators.required]}
    ],
    Negocjacje: [
      {
        controlName: 'expectedDiscount',
        label: 'Oczekiwany rabat (%)',
        type: 'number',
        validators: [Validators.required]
      }
    ]
  };
  currentDynamicFieldsConfig: { controlName: string; label: string; type: string }[] = [];

  newNoteText = '';
  newChecklistText = '';

  constructor(
      private fb: FormBuilder,
      private route: ActivatedRoute,
      private router: Router,
      private service: SalesFunnelService,
      private auth: AuthService
  ) {
    this.user$ = this.auth.user$;
  }

  ngOnInit() {
    this.initForm();

    this.route.paramMap.pipe(
        tap(pm => {
          const id = pm.get('id');
          this.isEdit = !!id;
          this.leadId = id ?? undefined;
        }),
        switchMap(() => {
          const stages$ = this.service.getStages();
          const lead$ = this.isEdit ? this.service.getLead(this.leadId!) : of<Lead | null>(null);
          return combineLatest([stages$, lead$]);
        })
    ).subscribe(([stages, lead]) => {
      // Załaduj i posortuj etapy
      this.stages = stages.sort((a, b) => a.order - b.order);

      // Dodaj dynamiczne kontrolki wg initial stageId
      const initialStageId = lead ? lead.stageId : this.stages[0].id;
      this.setDynamicFields(initialStageId, lead);

      console.log('Kontrolki przed patchValue:', Object.keys(this.form.controls));

      // Wypełnij formularz danymi
      if (lead) {
        this.form.patchValue({
          title: lead.title,
          description: lead.description,
          stageId: lead.stageId,
          createdAt: lead.createdAt,
          stageChangedAt: lead.stageChangedAt
        });
        this.loadArray('notes', lead.notes || []);
        this.loadArray('checklist', lead.checklist || []);
        this.loadArray('attachments', lead.attachments || []);
      } else {
        this.form.patchValue({
          stageId: initialStageId,
          createdAt: new Date().toISOString(),
          stageChangedAt: new Date().toISOString()
        });
      }

      // Subskrybuj zmiany etapu tylko raz
      this.form.get('stageId')!
          .valueChanges
          .pipe(distinctUntilChanged())
          .subscribe(stageId => {
            this.setDynamicFields(stageId);
            this.form.get('stageChangedAt')!.setValue(new Date().toISOString());
          });
    });
  }

  private initForm() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      stageId: ['', Validators.required],
      createdAt: [''],
      stageChangedAt: [''],
      notes: this.fb.array([]),
      checklist: this.fb.array([]),
      attachments: this.fb.array([])
    });
  }

  private loadArray(arrayName: 'notes' | 'checklist' | 'attachments', items: any[]) {
    const fa = this.form.get(arrayName) as FormArray;
    fa.clear();
    items.forEach(item => fa.push(this.fb.group(item)));
  }

  private setDynamicFields(stageId: string, lead?: Lead | null) {
    console.log('setDynamicFields -> stageId=', stageId, 'lead?', !!lead);

    // Usuń poprzednie
    this.currentDynamicFieldsConfig.forEach(f =>
        this.form.removeControl(f.controlName)
    );
    this.currentDynamicFieldsConfig = [];

    const stage = this.stages.find(s => s.id === stageId);
    const cfg = stage && this.dynamicFieldsConfig[stage.name];
    if (!cfg) {
      console.log('Brak dynamicFieldsConfig dla etapu:', stage?.name);
      return;
    }

    cfg.forEach(fld => {
      const initVal = lead ? (lead as any)[fld.controlName] ?? '' : '';
      console.log('  + addControl(', fld.controlName, ')=', initVal);
      this.form.addControl(
          fld.controlName,
          new FormControl(initVal, fld.validators || [])
      );
      this.currentDynamicFieldsConfig.push({
        controlName: fld.controlName,
        label: fld.label,
        type: fld.type
      });
    });

    console.log('Form.controls po setDynamicFields:', Object.keys(this.form.controls));
  }

  get notes() {
    return this.form.get('notes') as FormArray;
  }

  get checklist() {
    return this.form.get('checklist') as FormArray;
  }

  get attachments() {
    return this.form.get('attachments') as FormArray;
  }

  addNote() {
    const text = this.newNoteText.trim();
    if (!text) return;
    this.notes.push(this.fb.group({
      id: uuidv4(),
      text,
      createdAt: new Date().toISOString()
    }));
    this.newNoteText = '';
  }

  removeNote(i: number) {
    this.notes.removeAt(i);
  }

  addChecklistItem() {
    const text = this.newChecklistText.trim();
    if (!text) return;
    this.checklist.push(this.fb.group({
      id: uuidv4(),
      text,
      done: false
    }));
    this.newChecklistText = '';
  }

  removeChecklistItem(i: number) {
    this.checklist.removeAt(i);
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        this.attachments.push(this.fb.group({
          id: uuidv4(),
          fileName: file.name,
          dataUrl: reader.result
        }));
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeAttachment(i: number) {
    this.attachments.removeAt(i);
  }

  onSubmit() {
    if (this.form.invalid) return;
    const raw = this.form.value;
    const dynamic = this.currentDynamicFieldsConfig.reduce((acc, f) => {
      acc[f.controlName] = raw[f.controlName];
      return acc;
    }, {} as any);

    if (this.isEdit) {
      const updated: Lead = {
        id: this.leadId!,
        title: raw.title,
        description: raw.description,
        stageId: raw.stageId,
        createdAt: raw.createdAt,
        stageChangedAt: raw.stageChangedAt,
        notes: raw.notes,
        checklist: raw.checklist,
        attachments: raw.attachments,
        ...dynamic
      };
      this.service.updateLead(updated)
          .subscribe(() => this.router.navigate(['/sales-funnel']));
    } else {
      const toCreate: Omit<Lead, 'id'> = {
        title: raw.title,
        description: raw.description,
        stageId: raw.stageId,
        createdAt: raw.createdAt,
        stageChangedAt: raw.stageChangedAt,
        notes: raw.notes,
        checklist: raw.checklist,
        attachments: raw.attachments,
        ...dynamic
      };
      this.service.createLead(toCreate)
          .subscribe(created => this.router.navigate(['/sales-funnel', 'lead', created.id]));
    }
  }
}
