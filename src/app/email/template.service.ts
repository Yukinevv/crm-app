import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Template} from './template.model';
import {Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class TemplateService {
  private apiUrl = '/api/emailTemplates';

  constructor(private http: HttpClient) {
  }

  getTemplates(): Observable<Template[]> {
    return this.http.get<Template[]>(this.apiUrl);
  }

  getTemplate(id: string): Observable<Template> {
    return this.http.get<Template>(`${this.apiUrl}/${id}`);
  }
}
