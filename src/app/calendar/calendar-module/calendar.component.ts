import {Component, OnInit} from '@angular/core';
import {CalendarOptions, DateSelectArg, EventClickArg, EventContentArg} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import {Router} from '@angular/router';
import {EventService} from '../event.service';
import {CalendarEvent} from '../calendar-event.model';
import {FullCalendarModule} from '@fullcalendar/angular';
import {Contact} from '../../contacts/contact.model';
import {ContactService} from '../../contacts/contact.service';
import {AuthService} from '../../auth/auth.service';
import {firstValueFrom} from 'rxjs';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  imports: [
    FullCalendarModule
  ],
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  calendarOptions: CalendarOptions;
  private contactsList: Contact[] = [];
  private currentUserUid = '';

  constructor(
    private eventService: EventService,
    private router: Router,
    private auth: AuthService,
    private contactService: ContactService
  ) {
    this.calendarOptions = {
      plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin],
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today newEventBtn',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      customButtons: {
        newEventBtn: {
          text: 'Nowe spotkanie',
          click: () => this.router.navigate(['/calendar/new'])
        }
      },
      editable: true,
      selectable: true,
      select: this.handleDateSelect.bind(this),
      eventClick: this.handleEventClick.bind(this),
      eventContent: this.renderEventContent.bind(this),
      events: []
    };
  }

  async ngOnInit(): Promise<void> {
    // Pobierz UID zalogowanego
    const user = await firstValueFrom(this.auth.user$);
    if (user) {
      this.currentUserUid = user.uid;
    }

    // Pobierz listę kontaktów
    this.contactsList = await firstValueFrom(this.contactService.getAll());

    // Załaduj wydarzenia do kalendarza
    this.loadEvents();
  }

  private loadEvents(): void {
    this.eventService.getAll().subscribe((evts: CalendarEvent[]) => {
      this.calendarOptions.events = evts.map(e => {
        const eventObj: any = {
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay
        };

        // tylko jeśli to wydarzenie z kalendarza (ma userId) - nie pokażemy dla rezerwacji
        if (e.userId) {
          const isCreator = e.userId === this.currentUserUid;
          const contact = this.contactsList.find(c => c.linkedUid === e.userId);
          const creatorName = isCreator
            ? 'Ty'
            : contact
              ? `${contact.firstName} ${contact.lastName}`
              : '—';
          eventObj.extendedProps = {creatorName};
        }

        return eventObj;
      });
    });
  }

  private renderEventContent(arg: EventContentArg) {
    const domNodes: HTMLElement[] = [];

    // zawsze dodajemy tytuł
    const titleEl = document.createElement('div');
    titleEl.innerText = arg.event.title;
    domNodes.push(titleEl);

    // tylko jeśli jest extendedProps.creatorName - dodajemy linię z twórcą
    const creatorName = (arg.event.extendedProps as any)?.creatorName as string | undefined;
    if (creatorName) {
      const creatorEl = document.createElement('div');
      creatorEl.classList.add('fc-event-creator');
      creatorEl.innerText = `Utworzył: ${creatorName}`;
      domNodes.push(creatorEl);
    }

    return {domNodes};
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.router.navigate(['/calendar/new'], {
      queryParams: {
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        allDay: selectInfo.allDay
      }
    });
  }

  private handleEventClick(clickInfo: EventClickArg): void {
    this.router.navigate([`/calendar/${clickInfo.event.id}/edit`]);
  }
}
