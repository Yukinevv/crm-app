import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Contact } from './contact.model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private contacts: Contact[] = [];
  private contactsSubject = new BehaviorSubject<Contact[]>([]);
  contacts$: Observable<Contact[]> = this.contactsSubject.asObservable();

  private idCounter = 1;

  constructor() {
    this.emit();
  }

  private emit() {
    this.contactsSubject.next([...this.contacts]);
  }

  getAll(): Contact[] {
    return [...this.contacts];
  }

  getById(id: number): Contact | undefined {
    return this.contacts.find(c => c.id === id);
  }

  create(contact: Omit<Contact, 'id'>): void {
    const newContact: Contact = {
      id: this.idCounter++,
      ...contact
    };
    this.contacts.push(newContact);
    this.emit();
  }

  update(updated: Contact): void {
    const idx = this.contacts.findIndex(c => c.id === updated.id);
    if (idx > -1) {
      this.contacts[idx] = { ...updated };
      this.emit();
    }
  }

  delete(id: number): void {
    this.contacts = this.contacts.filter(c => c.id !== id);
    this.emit();
  }
}
