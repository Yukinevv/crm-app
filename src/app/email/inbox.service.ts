import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
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

export interface InboxQuery {
  limit?: number;
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string;   // 'YYYY-MM-DD'
  unread?: boolean;
}

@Injectable({providedIn: 'root'})
export class InboxService {
  private base = '/api/inbox';

  constructor(private http: HttpClient) {
  }

  list(query: InboxQuery = {}): Observable<InboxItem[]> {
    let params = new HttpParams();
    if (query.limit != null) params = params.set('limit', String(query.limit));
    if (query.q) params = params.set('q', query.q);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.subject) params = params.set('subject', query.subject);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.unread) params = params.set('unread', '1');

    return this.http
      .get<{ items: InboxItem[] }>(`${this.base}/messages`, {params})
      .pipe(map(r => r.items || []));
  }

  getMessage(id: string): Observable<InboxMessage> {
    return this.http.get<InboxMessage>(`${this.base}/message/${encodeURIComponent(id)}`);
  }

  markRead(id: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base}/markRead`, {id});
  }
}
