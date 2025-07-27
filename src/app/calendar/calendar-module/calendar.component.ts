import {Component, OnInit} from '@angular/core';
import {CalendarOptions, DateSelectArg, EventClickArg} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import {Router} from '@angular/router';
import {EventService} from '../event.service';
import {CalendarEvent} from '../calendar-event.model';
import {FullCalendarModule} from '@fullcalendar/angular';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  imports: [
    FullCalendarModule
  ],
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  calendarOptions: CalendarOptions = {
    plugins: [
      interactionPlugin,
      dayGridPlugin,
      timeGridPlugin
    ],
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
    events: []
  };

  constructor(
    private eventService: EventService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.eventService.getAll().subscribe((evts: CalendarEvent[]) => {
      this.calendarOptions.events = evts.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay
      }));
    });
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
