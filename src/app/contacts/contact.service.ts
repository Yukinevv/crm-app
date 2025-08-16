import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Contact} from './contact.model';
import {Observable, of, throwError} from 'rxjs';
import {catchError, finalize, map, shareReplay, switchMap, take, tap} from 'rxjs/operators';
import {AuthService} from '../auth/auth.service';

interface ContactCache {
  userId: string;
  list: Contact[];
  loadedAt: number; // epoch ms
}

@Injectable({providedIn: 'root'})
export class ContactService {
  private baseUrl = '/api/contacts';

  // In-memory cache per user
  private cache: ContactCache | null = null;
  private readonly TTL_MS = 3 * 60 * 1000; // 3 min

  // Pending fetch per user (dedup równoległych GET-ów)
  private pending: Record<string, Observable<Contact[]>> = {};

  // Storage (utrwalenie między F5) - sessionStorage, żeby nie wisiało po zamknięciu karty
  private storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null;

  private storageKey(userId: string) {
    return `contactsCache_v1_${userId}`;
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
    // Wyczyść cache przy wylogowaniu
    this.auth.user$.subscribe(u => {
      if (!u) {
        this.cache = null;
        this.pending = {};
      }
    });
  }

  // ===== Public API =====

  getAll(forceRefresh = false): Observable<Contact[]> {
    return this.getAllCached({forceRefresh});
  }

  getAllCached(opts?: { forceRefresh?: boolean; ttlMs?: number }): Observable<Contact[]> {
    const ttl = opts?.ttlMs ?? this.TTL_MS;

    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return of([] as Contact[]);
        const uid = user.uid;

        // Spróbuj pamięć (RAM)
        const now = Date.now();
        if (!opts?.forceRefresh &&
          this.cache &&
          this.cache.userId === uid &&
          now - this.cache.loadedAt < ttl) {
          return of([...this.cache.list]);
        }

        // Spróbuj storage (po F5)
        if (!opts?.forceRefresh && this.storage) {
          const stored = this.readFromStorage(uid);
          if (stored && now - stored.loadedAt < ttl) {
            // odśwież in-memory cache z storage i zwróć
            this.cache = {...stored};
            return of([...stored.list]);
          }
        }

        // Dedup: jeśli już trwa fetch dla tego usera
        if (this.pending[uid]) {
          return this.pending[uid];
        }

        // HTTP -> cache (RAM and storage) -> shareReplay
        const req$ = this.http
          .get<Contact[]>(`${this.baseUrl}?userId=${uid}`)
          .pipe(
            tap(list => this.setCache(uid, list ?? [])),
            catchError(() => of([] as Contact[])),
            shareReplay(1),
            finalize(() => {
              delete this.pending[uid];
            })
          );

        this.pending[uid] = req$;
        return req$;
      })
    );
  }

  getById(id: string): Observable<Contact> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return throwError(() => new Error('Nieautoryzowany'));
        const uid = user.uid;

        const cached = (this.cache?.userId === uid)
          ? this.cache!.list.find(c => c.id === id)
          : undefined;

        if (cached) return of(cached);

        // ewentualnie spróbuj storage
        const stored = this.storage ? this.readFromStorage(uid) : null;
        const foundStored = stored?.list?.find(c => c.id === id);
        if (foundStored) {
          // wczytaj do RAM dla spójności
          if (!this.cache || this.cache.userId !== uid) {
            this.cache = {userId: uid, list: stored!.list, loadedAt: stored!.loadedAt};
          }
          return of(foundStored);
        }

        return this.http.get<Contact>(`${this.baseUrl}/${id}`);
      })
    );
  }

  create(contact: Omit<Contact, 'id'>): Observable<Contact> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return throwError(() => new Error('Nieautoryzowany'));
        const uid = user.uid;
        return this.http.post<Contact>(this.baseUrl, {...contact, userId: uid}).pipe(
          tap(created => {
            // aktualizuj RAM i storage
            const list = (this.cache?.userId === uid) ? [...this.cache.list, created] : [created];
            this.setCache(uid, list);
          })
        );
      })
    );
  }

  update(contact: Contact): Observable<Contact> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return throwError(() => new Error('Nieautoryzowany'));
        const uid = user.uid;
        return this.http.put<Contact>(`${this.baseUrl}/${contact.id}`, contact).pipe(
          tap(updated => {
            if (this.cache?.userId === uid) {
              const list = [...this.cache.list];
              const idx = list.findIndex(c => c.id === updated.id);
              if (idx >= 0) list[idx] = updated; else list.push(updated);
              this.setCache(uid, list);
            } else {
              this.setCache(uid, [updated]);
            }
          })
        );
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return throwError(() => new Error('Nieautoryzowany'));
        const uid = user.uid;
        return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
          tap(() => {
            if (this.cache?.userId === uid) {
              const list = this.cache.list.filter(c => c.id !== id);
              this.setCache(uid, list);
            }
          })
        );
      })
    );
  }

  invalidateCache(): void {
    this.cache = null;
  }

  resolveByEmail(email: string, opts?: { forceRefresh?: boolean }): Observable<Contact | undefined> {
    const norm = this.normalizeEmail(email);
    return this.getAllCached({forceRefresh: !!opts?.forceRefresh}).pipe(
      map(list => list.find(c => this.normalizeEmail(c.email) === norm))
    );
  }

  // ===== helpers =====

  private setCache(userId: string, list: Contact[]): void {
    const entry: ContactCache = {userId, list, loadedAt: Date.now()};
    this.cache = entry;
    if (this.storage) {
      try {
        this.storage.setItem(this.storageKey(userId), JSON.stringify(entry));
      } catch { /* ignore */
      }
    }
  }

  private readFromStorage(userId: string): ContactCache | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(this.storageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ContactCache;
      if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.list)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private normalizeEmail(e: string | null | undefined): string {
    return String(e || '').trim().toLowerCase();
  }
}
