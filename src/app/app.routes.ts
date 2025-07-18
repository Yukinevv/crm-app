import {Routes} from '@angular/router';
import {TestComponent} from './test/test.component';
import {LoginComponent} from './auth/login/login.component';
import {RegisterComponent} from './auth/register/register.component';

export const routes: Routes = [
  {path: 'login', component: LoginComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'test', component: TestComponent},
  {
    path: 'sales-funnel',
    loadChildren: () =>
      import('./sales-funnel/sales-funnel.module').then(
        (m) => m.SalesFunnelModule
      )
  },
  {
    path: 'contacts',
    loadChildren: () =>
      import('./contacts/contacts.module').then((m) => m.ContactsModule)
  },
  {path: '', redirectTo: '/contacts', pathMatch: 'full'}
];
