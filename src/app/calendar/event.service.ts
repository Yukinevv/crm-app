import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CalendarEvent, CreateEvent, ParticipantSnapshot, UpdateEvent} from './calendar-event.model';
import {Observable, of} from 'rxjs';
import {AuthService} from '../auth/auth.service';
import {map, switchMap} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class EventService {
  private baseUrl = '/api/events';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
  }

  getAll(): Observable<CalendarEvent[]> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        return this.http.get<CalendarEvent[]>(this.baseUrl).pipe(
          map(events =>
            events.filter(e =>
              // rezerwacje (brak userId)
              (!e.userId) ||
              // własne eventy
              e.userId === user.uid ||
              // zaproszenia
              (e.invitedUserIds?.includes(user.uid) ?? false)
            )
          )
        );
      })
    );
  }

  getGlobal(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(this.baseUrl);
  }

  getById(id: string): Observable<CalendarEvent> {
    return this.http.get<CalendarEvent>(`${this.baseUrl}/${id}`);
  }

  create(evt: CreateEvent): Observable<CalendarEvent> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.post<CalendarEvent>(
          this.baseUrl,
          {...evt, userId: user.uid}
        );
      })
    );
  }

  update(evt: UpdateEvent): Observable<CalendarEvent> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.put<CalendarEvent>(
          `${this.baseUrl}/${evt.id}`,
          {...evt, userId: user.uid}
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

  leaveEvent(
    id: string,
    participants: string[],
    invitedUserIds: string[],
    participantsSnapshot: ParticipantSnapshot[]
  ): Observable<CalendarEvent> {
    return this.http.patch<CalendarEvent>(
      `${this.baseUrl}/${id}`,
      {participants, invitedUserIds, participantsSnapshot}
    );
  }
}
