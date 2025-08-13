import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';

export interface ClickEvent {
  id: string;
  messageId: string;
  recipient: string | null;
  url: string;
  userAgent: string | null;
  ip: string | null;
  ts: string | null; // ISO
}

export interface ClickSummary {
  messageId: string;
  count: number;
  lastTs: string | null;
}

@Injectable({providedIn: 'root'})
export class EmailStatsService {
  constructor(private http: HttpClient) {
  }

  getSummary(sinceDays = 365): Observable<ClickSummary[]> {
    return this.http.get<{ items: ClickSummary[] }>('/api/stats/clicks/summary', {
      params: {sinceDays}
    }).pipe(map(r => r.items));
  }

  getClicksByMessageId(messageId: string, limit = 500): Observable<ClickEvent[]> {
    return this.http.get<{ items: ClickEvent[] }>('/api/stats/clicks', {
      params: {messageId, limit}
    }).pipe(map(r => r.items));
  }

  summaryCsvUrl(sinceDays = 365): string {
    return `/api/stats/clicks/summary.csv?sinceDays=${sinceDays}`;
  }

  clicksCsvUrl(messageId: string): string {
    return `/api/stats/clicks/csv?messageId=${encodeURIComponent(messageId)}`;
  }
}
