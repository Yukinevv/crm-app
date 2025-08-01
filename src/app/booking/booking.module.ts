import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
import {BookingRoutingModule} from './booking-routing.module';
import {BookingComponent} from './booking/booking.component';
import {BookingFormComponent} from './booking-form/booking-form.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BookingRoutingModule,
    BookingComponent,
    BookingFormComponent
  ]
})
export class BookingModule {
}
