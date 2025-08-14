import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {map, Observable, of, retry, switchMap, take} from 'rxjs';
import {AuthService} from '../../auth/auth.service';
import {Conversation} from './conversations.model';

export interface LogEmailPayload {
  userId: string;
  direction: 'out' | 'in';
  subject: string;
  body: string;
  date?: string;
  emailId: string;
  counterpartEmail: string;
  contactId?: string; // opcjonalnie
}

@Injectable({providedIn: 'root'})
export class ConversationService {
  private base = '/api/conversations';
  private contactsBase = '/api/contacts';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
  }

  list(params?: {
    contactId?: string;
    leadId?: string;
    q?: string;
    limit?: number;
    counterpartEmail?: string;
  }): Observable<Conversation[]> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of({items: [] as Conversation[]});
        }

        let p = new HttpParams().set('userId', user.uid);
        if (params?.contactId) p = p.set('contactId', params.contactId);
        if (params?.leadId) p = p.set('leadId', params.leadId);
        if (params?.q) p = p.set('q', params.q);
        if (params?.limit) p = p.set('limit', String(params.limit));
        if (params?.counterpartEmail) p = p.set('counterpartEmail', params.counterpartEmail);

        return this.http.get<{ items: Conversation[] }>(this.base, {params: p});
      }),
      map(resp => resp.items ?? [])
    );
  }

  logEmailAutoLink(payload: Omit<LogEmailPayload, 'contactId'>): Observable<{ ok: true; conversation: Conversation }> {
    const ce = this.normalizeEmail(payload.counterpartEmail);

    return of(null).pipe(
      switchMap(() => this.auth.user$.pipe(take(1))),
      switchMap(user => {
        const uid = payload.userId || user?.uid || '';
        if (!uid) {
          // Brak użytkownika, nie można pobrać kontaktów - strzelaj bez contactId
          return this.http.post<{ ok: true; conversation: Conversation }>(
            `${this.base}/logEmail`,
            payload
          );
        }

        // Pobierz kontakty użytkownika z json-server (po userId), potem dopasuj email po stronie klienta
        return this.http.get<any[]>(`${this.contactsBase}`, {
          params: new HttpParams().set('userId', uid)
        }).pipe(
          map(list => {
            const contact = (list || []).find(c => this.normalizeEmail(c?.email) === ce);
            return contact?.id as string | undefined;
          }),
          switchMap(contactId => {
            const body: LogEmailPayload = {...payload, userId: uid, contactId};
            return this.http.post<{ ok: true; conversation: Conversation }>(
              `${this.base}/logEmail`,
              body
            );
          }),
          // delikatny retry w DEV na wypadek chwilowej niedostępności Functions
          retry({count: 1, delay: 120})
        );
      })
    );
  }

  // ===== utils =====

  private normalizeEmail(e: string | null | undefined): string {
    return String(e || '').trim().toLowerCase();
  }
}
