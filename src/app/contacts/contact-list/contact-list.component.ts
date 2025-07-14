import {Component, OnInit} from '@angular/core';
import {Contact} from '../contact.model';
import {ContactService} from '../contact.service';
import {RouterLink} from '@angular/router';
import {AsyncPipe, NgForOf} from '@angular/common';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [RouterLink, NgForOf, AsyncPipe],
  templateUrl: './contact-list.component.html'
})
export class ContactListComponent implements OnInit {
  contacts$!: Observable<Contact[]>;

  constructor(private contactService: ContactService) {
  }

  ngOnInit() {
    this.loadContacts();
  }

  loadContacts() {
    this.contacts$ = this.contactService.getAll();
  }

  onDelete(id: number) {
    if (confirm('Usunąć ten kontakt?')) {
      this.contactService.delete(id).subscribe(() => this.loadContacts());
    }
  }
}
