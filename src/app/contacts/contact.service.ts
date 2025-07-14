import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Contact} from './contact.model';
import {Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class ContactService {
  private baseUrl = '/api/contacts';

  constructor(private http: HttpClient) {
  }

  getAll(): Observable<Contact[]> {
    return this.http.get<Contact[]>(this.baseUrl);
  }

  getById(id: number): Observable<Contact> {
    return this.http.get<Contact>(`${this.baseUrl}/${id}`);
  }

  create(contact: Omit<Contact, 'id'>): Observable<Contact> {
    return this.http.post<Contact>(this.baseUrl, contact);
  }

  update(contact: Contact): Observable<Contact> {
    return this.http.put<Contact>(`${this.baseUrl}/${contact.id}`, contact);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
