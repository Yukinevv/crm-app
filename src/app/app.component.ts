import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {ContactListComponent} from './contacts/contact-list/contact-list.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'crm-app';
}
