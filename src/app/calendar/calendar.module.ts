import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FullCalendarModule} from '@fullcalendar/angular';
import {ReactiveFormsModule} from '@angular/forms';

import {CalendarRoutingModule} from './calendar-routing.module';
import {CalendarComponent} from './calendar-module/calendar.component';
import {EventFormComponent} from './event-form/event-form.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FullCalendarModule,
    CalendarRoutingModule,
    CalendarComponent,
    EventFormComponent
  ]
})
export class CalendarModule {
}
