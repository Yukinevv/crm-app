import {Component, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {Contact} from '../contact.model';
import {ContactService} from '../contact.service';
import {Router, RouterLink} from '@angular/router';
import {AsyncPipe, NgForOf} from '@angular/common';

@Component({
  selector: 'app-contact-list',
  imports: [
    RouterLink,
    NgForOf,
    AsyncPipe
  ],
  templateUrl: './contact-list.component.html'
})
export class ContactListComponent implements OnInit {
  contacts$!: Observable<Contact[]>;

  constructor(private contactService: ContactService, private router: Router) {
  }

  ngOnInit() {
    this.contacts$ = this.contactService.contacts$;
  }

  onDelete(id: number) {
    if (confirm('Usunąć ten kontakt?')) {
      this.contactService.delete(id);
    }
  }
}
