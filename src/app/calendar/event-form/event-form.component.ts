import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {take} from 'rxjs/operators';
import {Contact} from '../../contacts/contact.model';
import {EventService} from '../event.service';
import {ContactService} from '../../contacts/contact.service';
import {CalendarEvent, CreateEvent, UpdateEvent} from '../calendar-event.model';
import {NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-event-form',
  templateUrl: './event-form.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgForOf
  ],
  styleUrls: ['./event-form.component.scss']
})
export class EventFormComponent implements OnInit {
  form!: FormGroup;
  editId?: string;
  contactsList: Contact[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    protected router: Router,
    private eventService: EventService,
    private contactService: ContactService
  ) {
  }

  ngOnInit(): void {
    this.contactService.getAll().pipe(take(1)).subscribe(list => this.contactsList = list);

    this.form = this.fb.group({
      title: ['', Validators.required],
      participants: [[] as string[]],
      location: [''],
      virtualLink: [''],
      start: ['', Validators.required],
      end: ['', Validators.required],
      allDay: [false],
      reminderMinutesBefore: [15]
    });

    this.route.paramMap.pipe(take(1)).subscribe(pm => {
      const id = pm.get('id');
      if (id) {
        this.editId = id;
        this.eventService.getById(id).pipe(take(1)).subscribe((evt: CalendarEvent) => {
          const start = this.formatForInput(evt.start);
          const end = this.formatForInput(evt.end);
          this.form.patchValue({...evt, start, end});
        });
      } else {
        this.route.queryParams.pipe(take(1)).subscribe((qp: Params) => {
          let start = qp['start'] as string;
          let end = qp['end'] as string;
          const allDay = qp['allDay'] === 'true';

          // jeśli mamy tylko 'YYYY-MM-DD', dopisujemy 'T00:00'
          if (start && start.length === 10) {
            start = `${start}T00:00`;
          }
          if (end && end.length === 10) {
            end = `${end}T00:00`;
          }
          this.form.patchValue({start, end, allDay});
        });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const raw = this.form.value as CreateEvent;

    if (this.editId) {
      const updateEvt: UpdateEvent = {id: this.editId, ...raw};
      this.eventService.update(updateEvt)
        .pipe(take(1))
        .subscribe(() => this.router.navigate(['/calendar']));
    } else {
      const createEvt: CreateEvent = raw;
      this.eventService.create(createEvt)
        .pipe(take(1))
        .subscribe(() => this.router.navigate(['/calendar']));
    }
  }

  /**
   * Konwertuje dowolny ISO‐string (z ewentualną strefą UTC)
   * do lokalnego formatu 'YYYY-MM-DDThh:mm' wymaganym przez datetime-local.
   */
  private formatForInput(dateStr: string): string {
    const date = new Date(dateStr);
    // korekta na lokalną strefę
    const tzOffset = date.getTimezoneOffset();
    date.setMinutes(date.getMinutes() - tzOffset);
    // obetnij do 'YYYY-MM-DDThh:mm'
    return date.toISOString().slice(0, 16);
  }

  get selectedParticipants(): string[] {
    return this.form.get('participants')!.value;
  }
  
  onParticipantSelect(ev: Event): void {
    const select = ev.target as HTMLSelectElement;
    const id = select.value;
    if (!id) return;
    const current = this.selectedParticipants;
    if (!current.includes(id)) {
      this.form.get('participants')!.setValue([...current, id]);
    }
    // zresetuj wybór w select
    select.value = '';
  }

  removeParticipant(id: string): void {
    const filtered = this.selectedParticipants.filter(pid => pid !== id);
    this.form.get('participants')!.setValue(filtered);
  }

  getContactName(id: string): string {
    const c = this.contactsList.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }
}
