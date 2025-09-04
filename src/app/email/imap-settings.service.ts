import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {from, map, Observable, switchMap} from 'rxjs';
import {Auth} from '@angular/fire/auth';

export interface ImapConfigDto {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  mailbox?: string;
}

export interface ImapConfigView {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  mailbox: string;
  hasPassword: boolean;
  updatedAt?: string | null;
}

@Injectable({providedIn: 'root'})
export class ImapSettingsService {
  private base = '/api/imap';

  constructor(private http: HttpClient, private auth: Auth) {
  }

  /** Zwraca token ID lub null jeśli brak użytkownika. */
  private idToken$(): Observable<string | null> {
    const p = this.auth.currentUser
      ? this.auth.currentUser.getIdToken()
      : Promise.resolve(null);
    return from(p);
  }

  /** Wymusza observe: 'body' (żeby nie łapać HttpEvent<T>) + Authorization */
  private buildOptions(token: string | null, params?: HttpParams) {
    const headers = token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : undefined;
    return {headers, params, observe: 'body' as const};
  }

  get(): Observable<ImapConfigView | null> {
    return this.idToken$().pipe(
      switchMap(token =>
        this.http.get<ImapConfigView>(`${this.base}/config`, this.buildOptions(token))
      ),
      map(r => r || null)
    );
  }

  save(cfg: ImapConfigDto): Observable<{ ok: true }> {
    return this.idToken$().pipe(
      switchMap(token =>
        this.http.post<{ ok: true }>(`${this.base}/config`, cfg, this.buildOptions(token))
      )
    );
  }

  test(cfg: ImapConfigDto): Observable<{ ok: true; mailboxes: string[]; sample?: { id: string; subject: string }[] }> {
    return this.idToken$().pipe(
      switchMap(token =>
        this.http.post<{ ok: true; mailboxes: string[]; sample?: { id: string; subject: string }[] }>(
          `${this.base}/test`,
          cfg,
          this.buildOptions(token)
        )
      )
    );
  }
}
