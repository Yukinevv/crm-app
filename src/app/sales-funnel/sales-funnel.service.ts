import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Stage} from './stage.model';
import {Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class SalesFunnelService {
  private baseUrl = '/api/stages';

  constructor(private http: HttpClient) {
  }

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
}
