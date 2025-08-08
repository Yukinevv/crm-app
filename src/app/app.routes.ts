import {Routes} from '@angular/router';
import {TestComponent} from './test/test.component';
import {LoginComponent} from './auth/login/login.component';
import {RegisterComponent} from './auth/register/register.component';
import {AuthGuard} from './auth/auth.guard';

export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'test', component: TestComponent},
  {
    path: 'email',
    loadChildren: () =>
      import('./email/email.module').then(m => m.EmailModule),
    canLoad: [AuthGuard],
    canActivate: [AuthGuard]
  },
  {
    path: 'sales-funnel',
    loadChildren: () =>
      import('./sales-funnel/sales-funnel.module').then(
        m => m.SalesFunnelModule
      )
  },
  {
    path: 'contacts',
    loadChildren: () =>
      import('./contacts/contacts.module').then(m => m.ContactsModule)
  },
  {
    path: 'calendar',
    loadChildren: () =>
      import('./calendar/calendar.module').then(m => m.CalendarModule),
    canLoad: [AuthGuard],
    canActivate: [AuthGuard]
  },
  {
    path: 'booking',
    loadChildren: () =>
      import('./booking/booking.module').then(m => m.BookingModule)
  },
  {path: '', redirectTo: '/contacts', pathMatch: 'full'},
  {path: '**', redirectTo: '/contacts'}
];
