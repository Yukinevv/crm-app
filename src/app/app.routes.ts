import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'contacts',
    loadChildren: () => import('./contacts/contacts.module').then(m => m.ContactsModule)
  },
  {path: '', redirectTo: '/contacts', pathMatch: 'full'}
];
