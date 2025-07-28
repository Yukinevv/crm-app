import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CalendarEvent, CreateEvent} from '../calendar/calendar-event.model';

@Injectable({providedIn: 'root'})
export class BookingService {
  private eventsUrl = '/api/events';

  constructor(private http: HttpClient) {
  }

  createBooking(evt: CreateEvent): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(this.eventsUrl, evt);
  }
}
