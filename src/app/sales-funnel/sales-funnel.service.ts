import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Stage} from './stage.model';
import {Observable, of} from 'rxjs';
import {Lead} from './lead.model';
import {AuthService} from '../auth/auth.service';
import {switchMap} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class SalesFunnelService {
  private baseUrl = '/api/stages';
  private leadUrl = '/api/leads';

  constructor(private http: HttpClient, private auth: AuthService) {
  }

  // etapy
  getStages(): Observable<Stage[]> {
    return this.auth.user$.pipe(
      switchMap(user =>
        user
          ? this.http.get<Stage[]>(`${this.baseUrl}?userId=${user.uid}`)
          : of([])
      )
    );
  }

  createStage(stage: Omit<Stage, 'id'>): Observable<Stage> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.post<Stage>(
          this.baseUrl,
          {...stage, userId: user.uid}
        );
      })
    );
  }

  updateStage(stage: Stage): Observable<Stage> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.put<Stage>(
          `${this.baseUrl}/${stage.id}`,
          stage
        );
      })
    );
  }

  deleteStage(id: string): Observable<void> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
      })
    );
  }

  // leady
  getLeads(): Observable<Lead[]> {
    return this.auth.user$.pipe(
      switchMap(user =>
        user
          ? this.http.get<Lead[]>(`${this.leadUrl}?userId=${user.uid}`)
          : of([])
      )
    );
  }

  getLead(id: string): Observable<Lead> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) return of(null as any);
        return this.http.get<Lead>(`${this.leadUrl}/${id}`);
      })
    );
  }

  createLead(lead: Omit<Lead, 'id'>): Observable<Lead> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.post<Lead>(
          this.leadUrl,
          {...lead, userId: user.uid}
        );
      })
    );
  }

  updateLead(lead: Lead): Observable<Lead> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.put<Lead>(
          `${this.leadUrl}/${lead.id}`,
          lead
        );
      })
    );
  }

  deleteLead(id: string): Observable<void> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) throw new Error('Nieautoryzowany');
        return this.http.delete<void>(`${this.leadUrl}/${id}`);
      })
    );
  }
}
