import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Slot} from './slot.model';

@Injectable({providedIn: 'root'})
export class SlotService {
  private baseUrl = '/api/slots';

  constructor(private http: HttpClient) {
  }

  getSlots(): Observable<Slot[]> {
    return this.http.get<Slot[]>(this.baseUrl);
  }

  getSlot(id: string): Observable<Slot> {
    return this.http.get<Slot>(`${this.baseUrl}/${id}`);
  }

  bookSlot(id: string): Observable<Slot> {
    return this.http.patch<Slot>(`${this.baseUrl}/${id}`, {booked: true});
  }
}
