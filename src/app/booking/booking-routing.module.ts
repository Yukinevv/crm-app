import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {BookingComponent} from './booking/booking.component';
import {BookingFormComponent} from './booking-form/booking-form.component';

const routes: Routes = [
  {path: '', component: BookingComponent},
  {path: 'form/:id', component: BookingFormComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BookingRoutingModule {
}
