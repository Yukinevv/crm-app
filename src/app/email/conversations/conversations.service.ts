import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {map, Observable, of, switchMap} from 'rxjs';
import {AuthService} from '../../auth/auth.service';
import {Conversation} from './conversations.model';

@Injectable({providedIn: 'root'})
export class ConversationService {
  private base = '/api/conversations';

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

  /** Log tworzymy przez dedykowany endpoint w Functions z auto-linkowaniem */
  logEmail(payload: {
    userId: string;
    direction: 'out' | 'in';
    subject: string;
    body: string;
    date?: string;
    emailId: string;
    counterpartEmail: string;
  }): Observable<{ ok: true; conversation: Conversation }> {
    return this.http.post<{ ok: true; conversation: Conversation }>(
      `${this.base}/logEmail`,
      payload
    );
  }
}
