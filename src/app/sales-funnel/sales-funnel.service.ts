import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Stage} from './stage.model';
import {Observable} from 'rxjs';
import {Lead} from './lead.model';

@Injectable({providedIn: 'root'})
export class SalesFunnelService {
  private baseUrl = '/api/stages';
  private leadUrl = '/api/leads';

  constructor(private http: HttpClient) {
  }

  // etapy
  getStages(): Observable<Stage[]> {
    return this.http.get<Stage[]>(this.baseUrl);
  }

  createStage(stage: Omit<Stage, 'id'>): Observable<Stage> {
    return this.http.post<Stage>(this.baseUrl, stage);
  }

  updateStage(stage: Stage): Observable<Stage> {
    return this.http.put<Stage>(`${this.baseUrl}/${stage.id}`, stage);
  }

  deleteStage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // leady
  getLeads(): Observable<Lead[]> {
    return this.http.get<Lead[]>(this.leadUrl);
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.leadUrl}/${id}`);
  }

  createLead(lead: Omit<Lead, 'id'>): Observable<Lead> {
    return this.http.post<Lead>(this.leadUrl, lead);
  }

  updateLead(lead: Lead): Observable<Lead> {
    return this.http.put<Lead>(`${this.leadUrl}/${lead.id}`, lead);
  }

  deleteLead(id: string): Observable<void> {
    return this.http.delete<void>(`${this.leadUrl}/${id}`);
  }
}
