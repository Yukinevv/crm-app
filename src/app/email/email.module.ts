import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {EmailListComponent} from './email-list/email-list.component';
import {EmailDetailComponent} from './email-detail/email-detail.component';
import {EmailComposeComponent} from './email-compose/email-compose.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {EmailRoutingModule} from './email.routing';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    EmailRoutingModule,
    EmailListComponent,
    EmailDetailComponent,
    EmailComposeComponent
  ]
})
export class EmailModule {
}
