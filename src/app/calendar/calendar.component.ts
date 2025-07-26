import {Component} from '@angular/core';
import {CalendarOptions, DateSelectArg, EventClickArg} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import {CommonModule} from '@angular/common';
import {FullCalendarModule} from '@fullcalendar/angular';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FullCalendarModule, CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  calendarOptions: CalendarOptions = {
    plugins: [
      interactionPlugin,
      dayGridPlugin,
      timeGridPlugin
    ],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    select: this.handleDateSelect.bind(this),
    eventClick: this.handleEventClick.bind(this),
    events: []  // później zostanie podłączony serwis zwracający JSON z serwera
  };

  private handleDateSelect(selectInfo: DateSelectArg) {
    const title = prompt('Tytuł spotkania:');
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();
    if (title) {
      calendarApi.addEvent({
        id: String(Date.now()),
        title,
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        allDay: selectInfo.allDay
      });
      // TODO: tutaj wywołać serwis zapisujący wydarzenie w json-server
    }
  }

  private handleEventClick(clickInfo: EventClickArg) {
    if (confirm(`Usunąć spotkanie "${clickInfo.event.title}"?`)) {
      clickInfo.event.remove();
      // TODO: tutaj wywołać serwis usuwający wydarzenie w json-server
    }
  }
}
