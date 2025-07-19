import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, Router, RouterLink} from '@angular/router';
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
import {forkJoin, of} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';

import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {Lead} from '../lead.model';

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
    private service: SalesFunnelService
  ) {
  }

  ngOnInit() {
    this.initForm();

    this.route.paramMap.pipe(
      tap((pm: ParamMap) => {
        const id = pm.get('id');
        this.isEdit = !!id;
        this.leadId = id ?? undefined;
      }),
      switchMap((pm: ParamMap) => {
        const id = pm.get('id');
        return forkJoin({
          stages: this.service.getStages(),
          lead: id ? this.service.getLead(id) : of<Lead | null>(null)
        });
      })
    ).subscribe(({stages, lead}) => {
      this.stages = stages.sort((a, b) => a.order - b.order);

      if (lead) {
        console.log('––– getLead zwróciło:', lead);
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
        this.setDynamicFields(lead.stageId, lead);
      } else {
        const now = new Date().toISOString();
        this.form.patchValue({
          stageId: this.stages[0].id,
          createdAt: now,
          stageChangedAt: now
        });
        this.setDynamicFields(this.stages[0].id);
      }

      this.form.get('stageId')!.valueChanges.subscribe(stageId => {
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

  private setDynamicFields(stageId: string, lead?: Lead) {
    this.currentDynamicFieldsConfig.forEach(f => this.form.removeControl(f.controlName));
    this.currentDynamicFieldsConfig = [];

    const stage = this.stages.find(s => s.id === stageId);
    const cfg = stage && this.dynamicFieldsConfig[stage.name];
    if (!cfg) return;

    cfg.forEach(fld => {
      const value = lead ? (lead as any)[fld.controlName] ?? '' : '';
      this.form.addControl(
        fld.controlName,
        new FormControl(value, fld.validators || [])
      );
      this.currentDynamicFieldsConfig.push({
        controlName: fld.controlName,
        label: fld.label,
        type: fld.type
      });
    });
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
        .subscribe(created => {
          this.router.navigate(['/sales-funnel', 'lead', created.id]);
        });
    }
  }
}
