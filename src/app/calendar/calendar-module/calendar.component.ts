import {Component, OnInit} from '@angular/core';
import {CalendarOptions, DateSelectArg, EventClickArg, EventContentArg} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import {Router} from '@angular/router';
import {EventService} from '../event.service';
import {CalendarEvent} from '../calendar-event.model';
import {AuthService} from '../../auth/auth.service';
import {firstValueFrom} from 'rxjs';
import {FullCalendarModule} from '@fullcalendar/angular';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FullCalendarModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  calendarOptions: CalendarOptions;
  private currentUserUid = '';
  viewAll = false;

  constructor(
    private eventService: EventService,
    private router: Router,
    private auth: AuthService
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
    const user = await firstValueFrom(this.auth.user$);
    this.currentUserUid = user?.uid ?? '';
    this.loadEvents();
  }

  setViewAll(all: boolean) {
    this.viewAll = all;
    this.loadEvents();
  }

  private loadEvents(): void {
    const source$ = this.viewAll
      ? this.eventService.getGlobal()
      : this.eventService.getAll();

    source$.subscribe((evts: CalendarEvent[]) => {
      this.calendarOptions = {
        ...this.calendarOptions,
        events: evts.map(e => {
          const obj: any = {
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay
          };
          if (e.userId) {
            const creatorName = e.creatorName ?? '—';
            obj.extendedProps = {
              creatorName: e.userId === this.currentUserUid ? 'Ty' : creatorName
            };
          }
          return obj;
        })
      };
    });
  }

  private renderEventContent(arg: EventContentArg) {
    const domNodes: HTMLElement[] = [];
    const titleEl = document.createElement('div');
    titleEl.innerText = arg.event.title;
    domNodes.push(titleEl);

    const creatorName = (arg.event.extendedProps as any)?.creatorName as string | undefined;
    if (creatorName != null) {
      const cEl = document.createElement('div');
      cEl.classList.add('fc-event-creator');
      cEl.innerText = `Utworzył: ${creatorName}`;
      domNodes.push(cEl);
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
