import {Routes} from '@angular/router';
import {TestComponent} from './test/test.component';

export const routes: Routes = [
  {path: 'test', component: TestComponent},
  {
    path: 'contacts',
    loadChildren: () => import('./contacts/contacts.module').then(m => m.ContactsModule)
  },
  {path: '', redirectTo: '/contacts', pathMatch: 'full'}
];
