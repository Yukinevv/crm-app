import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Contact} from './contact.model';
import {Observable, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {AuthService} from '../auth/auth.service';

@Injectable({providedIn: 'root'})
export class ContactService {
  private baseUrl = '/api/contacts';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
  }

  getAll(): Observable<Contact[]> {
    return this.auth.user$.pipe(
      switchMap(user =>
        user
          ? this.http.get<Contact[]>(`${this.baseUrl}?userId=${user.uid}`)
          : of([])
      )
    );
  }

  getById(id: string): Observable<Contact> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.get<Contact>(`${this.baseUrl}/${id}`);
      })
    );
  }

  create(contact: Omit<Contact, 'id'>): Observable<Contact> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.post<Contact>(
          this.baseUrl,
          {...contact, userId: user.uid}
        );
      })
    );
  }

  update(contact: Contact): Observable<Contact> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.put<Contact>(
          `${this.baseUrl}/${contact.id}`,
          contact
        );
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
      })
    );
  }
}
