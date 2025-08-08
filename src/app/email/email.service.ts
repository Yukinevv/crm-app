import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Email} from './email.model';

@Injectable({providedIn: 'root'})
export class EmailService {
  private apiUrl = '/api/emails';

  constructor(private http: HttpClient) {
  }

  getEmails(): Observable<Email[]> {
    return this.http.get<Email[]>(this.apiUrl);
  }

  getEmail(id: string): Observable<Email> {
    return this.http.get<Email>(`${this.apiUrl}/${id}`);
  }

  sendEmail(email: Omit<Email, 'id' | 'date' | 'isRead'>): Observable<Email> {
    const payload = {
      ...email,
      date: new Date().toISOString(),
      isRead: false
    };
    return this.http.post<Email>(this.apiUrl, payload);
  }

  markAsRead(id: string): Observable<Email> {
    return this.http.patch<Email>(`${this.apiUrl}/${id}`, {isRead: true});
  }
}
