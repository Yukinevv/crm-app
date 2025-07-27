import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CalendarComponent} from './calendar-module/calendar.component';
import {EventFormComponent} from './event-form/event-form.component';

const routes: Routes = [
  {path: '', component: CalendarComponent},
  {path: 'new', component: EventFormComponent},
  {path: ':id/edit', component: EventFormComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CalendarRoutingModule {
}
