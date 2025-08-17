import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';

export interface InboxItem {
  id: string;            // "mh:<id>" lub "imap:<uid>"
  provider: 'mailhog' | 'imap';
  from: string;
  to: string;
  subject: string;
  date: string;          // ISO
  isRead: boolean;
  preview?: string;
}

export interface InboxMessage {
  id: string;
  provider: 'mailhog' | 'imap';
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyHtml: string | null;
  bodyText: string | null;
}

@Injectable({providedIn: 'root'})
export class InboxService {
  private base = '/api/inbox';

  constructor(private http: HttpClient) {
  }

  list(limit = 50): Observable<InboxItem[]> {
    return this.http.get<{ items: InboxItem[] }>(`${this.base}/messages`, {params: {limit}})
      .pipe(map(r => r.items || []));
  }

  getMessage(id: string): Observable<InboxMessage> {
    return this.http.get<InboxMessage>(`${this.base}/message/${encodeURIComponent(id)}`);
  }

  markRead(id: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base}/markRead`, {id});
  }
}
