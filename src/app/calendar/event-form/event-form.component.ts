import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {take} from 'rxjs/operators';
import {Contact} from '../../contacts/contact.model';
import {EventService} from '../event.service';
import {ContactService} from '../../contacts/contact.service';
import {AuthService} from '../../auth/auth.service';
import {CalendarEvent, CreateEvent, ParticipantSnapshot, ParticipantWithFlag} from '../calendar-event.model';
import {NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgForOf],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.scss']
})
export class EventFormComponent implements OnInit {
  form: FormGroup;
  editId?: string;
  contactsList: Contact[] = [];
  eventData?: CalendarEvent & { participantsSnapshot?: ParticipantWithFlag[] };

  currentUserUid = '';
  currentUserEmail = '';
  currentUserDisplayName = '';
  isCreator = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private route: ActivatedRoute,
    protected router: Router,
    private eventService: EventService,
    private contactService: ContactService
  ) {
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
  }

  async ngOnInit(): Promise<void> {
    // Pobierz aktualnego użytkownika
    const user = await firstValueFrom(this.auth.user$);
    this.currentUserUid = user?.uid ?? '';
    this.currentUserEmail = user?.email ?? '';
    this.currentUserDisplayName = user?.displayName ?? this.currentUserEmail;

    // Pobierz kontakty twórcy (tylko potrzebne przy edycji przez twórcę)
    this.contactService.getAll().pipe(take(1))
      .subscribe(list => this.contactsList = list);

    // Sprawdź, czy to edycja, czy nowe wydarzenie
    this.route.paramMap.pipe(take(1)).subscribe(async pm => {
      const id = pm.get('id');
      if (id) {
        // Tryb edycji
        this.editId = id;
        const evt = await firstValueFrom(this.eventService.getById(id));
        this.isCreator = evt.userId === this.currentUserUid;

        const snap: ParticipantWithFlag[] = (evt.participantsSnapshot || []).map(p => ({
          ...p,
          isLinked: this.contactsList.some(c => c.linkedUid === p.uid)
        }));

        this.eventData = {...evt, participantsSnapshot: snap};

        // Wypełnij formularz pobranymi danymi
        this.form.patchValue({
          title: evt.title,
          participants: evt.participants,
          location: evt.location,
          virtualLink: evt.virtualLink,
          start: this.formatForInput(evt.start),
          end: this.formatForInput(evt.end),
          allDay: evt.allDay,
          reminderMinutesBefore: evt.reminderMinutesBefore ?? 0
        });

        if (!this.isCreator) {
          this.form.disable({emitEvent: false});
        }
      } else {
        // Nowe wydarzenie -> zawsze twórca
        this.isCreator = true;
        this.route.queryParams.pipe(take(1)).subscribe(qp => {
          let start = qp['start'] as string;
          let end = qp['end'] as string;
          const allDay = qp['allDay'] === 'true';
          if (start?.length === 10) start = `${start}T00:00`;
          if (end?.length === 10) end = `${end}T00:00`;
          this.form.patchValue({start, end, allDay});
        });
      }
    });
  }

  onSubmit(): void {
    if (!this.isCreator || this.form.invalid) return;

    const raw = this.form.value as CreateEvent;

    // UID zaproszonych
    const invitedUserIds = raw.participants
      .map(pid => this.contactsList.find(c => c.id === pid)?.linkedUid)
      .filter((uid): uid is string => !!uid);

    // Snapshot uczestników
    const participantsSnapshot: ParticipantSnapshot[] = raw.participants.map(pid => {
      const c = this.contactsList.find(x => x.id === pid)!;
      return {
        uid: c.linkedUid!,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email
      };
    });

    const base: CreateEvent = {
      title: raw.title,
      participants: raw.participants,
      invitedUserIds,
      creatorName: this.currentUserDisplayName,
      participantsSnapshot,
      location: raw.location,
      virtualLink: raw.virtualLink,
      start: raw.start,
      end: raw.end,
      allDay: raw.allDay,
      reminderMinutesBefore: raw.reminderMinutesBefore
    };

    const action$ = this.editId
      ? this.eventService.update({id: this.editId, ...base})
      : this.eventService.create(base);

    action$.pipe(take(1)).subscribe(() => this.router.navigate(['/calendar']));
  }

  addToContacts(p: ParticipantWithFlag): void {
    if (p.isLinked) return;
    const [firstName, ...rest] = p.name.split(' ');
    const lastName = rest.join(' ') || '';
    const contact: Omit<Contact, 'id'> = {
      firstName,
      lastName,
      company: '',
      position: '',
      phone: '',
      email: p.email,
      address: '',
      notes: '',
      tags: [],
      status: '',
      createdAt: new Date().toISOString(),
      source: 'Z zaproszenia',
      region: '',
      managerId: undefined,
      decisionMakerId: undefined,
      linkedUid: p.uid
    };

    this.contactService.create(contact).subscribe(created => {
      this.contactsList.push(created);
      p.isLinked = true;
    });
  }

  private formatForInput(dateStr: string): string {
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  onParticipantSelect(ev: Event): void {
    const select = ev.target as HTMLSelectElement;
    const id = select.value;
    if (!id) return;
    const current = this.form.get('participants')!.value as string[];
    if (!current.includes(id)) {
      this.form.get('participants')!.setValue([...current, id]);
    }
    select.value = '';
  }

  removeParticipant(id: string): void {
    const filtered = (this.form.get('participants')!.value as string[])
      .filter(pid => pid !== id);
    this.form.get('participants')!.setValue(filtered);
  }

  get selectedParticipants(): string[] {
    return this.form.get('participants')!.value;
  }

  getContactName(id: string): string {
    const c = this.contactsList.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }
}
