import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FullCalendarModule} from '@fullcalendar/angular';

import {CalendarRoutingModule} from './calendar-routing.module';
import {CalendarComponent} from './calendar.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FullCalendarModule,
    CalendarRoutingModule,
    CalendarComponent
  ]
})
export class CalendarModule {
}
