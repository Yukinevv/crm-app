import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, Observable, of, take} from 'rxjs';
import {Email} from './email.model';
import {AuthService} from '../auth/auth.service';
import {ConversationService} from './conversations/conversations.service';
import {map, switchMap} from 'rxjs/operators';

@Injectable({providedIn: 'root'})
export class EmailService {
  private apiUrl = '/api/emails';
  private mailSendUrl = '/api/mail/send';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private conversations: ConversationService
  ) {
  }

  /**
   * Zwraca tylko maile wysłane przez zalogowanego użytkownika (po userId)
   */
  getEmails(): Observable<Email[]> {
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return of([] as Email[]);
        return this.http.get<Email[]>(this.apiUrl, {params: {userId: user.uid}});
      })
    );
  }

  getEmail(id: string): Observable<Email> {
    return this.http.get<Email>(`${this.apiUrl}/${id}`);
  }

  /**
   * Wysyła mail (backend), opcjonalnie taguje linki UTM+tracking,
   * zapisuje w json-server oraz loguje konwersację.
   *
   * opts.contactId – jeżeli znany, przekażemy do logów konwersacji (dokładniejsze linkowanie).
   */
  sendEmail(
    email: Omit<Email, 'id' | 'date' | 'isRead'> & { trackLinks?: boolean },
    opts?: { contactId?: string }
  ): Observable<Email> {
    const messageId = this.generateMessageId();

    const tags = {
      utm_source: 'crm-app',
      utm_medium: 'email',
      utm_campaign: email.subject || 'brak-tematu',
      utm_content: messageId,
      utm_recipient: email.to
    };

    const withUtm = email.trackLinks ? this.tagAllLinks(email.body, tags) : email.body;
    const withTracking = email.trackLinks
      ? this.wrapWithTracking(withUtm, messageId, email.to)
      : withUtm;

    // Backend: fizyczna wysyłka (MailHog/SendGrid/Ethereal)
    const send$ = this.http.post<{ ok: boolean }>(this.mailSendUrl, {
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: withTracking,
      messageId
    });

    // Po wysłaniu odczytaj bieżącego usera (do userId) i zapisz wiadomość w db.json
    return this.auth.user$.pipe(
      take(1),
      switchMap(user => {
        const uid = user?.uid ?? '';

        return send$.pipe(
          switchMap(() => {
            const payload: Omit<Email, 'id'> = {
              userId: uid,
              from: email.from,
              to: email.to,
              subject: email.subject,
              body: withTracking,
              date: new Date().toISOString(),
              isRead: false,
              messageId,
              tags
            };
            return this.http.post<Email>(this.apiUrl, payload);
          }),
          // Po zapisaniu - zaloguj konwersację (z contactId lub auto-link)
          switchMap(saved => {
            if (!uid) {
              return of(saved);
            }

            const base = {
              userId: uid,
              direction: 'out' as const,
              subject: saved.subject,
              body: saved.body || '',
              date: saved.date,
              emailId: saved.id,
              counterpartEmail: saved.to
            };

            // Mamy contactId -> loguj bezpośrednio
            if (opts?.contactId) {
              return this.conversations.logEmail({
                ...base,
                contactId: opts.contactId
              }).pipe(
                catchError(err => {
                  console.warn('Log konwersacji (z contactId) nie zapisany', err);
                  return of({ok: false} as any);
                }),
                map(() => saved)
              );
            }

            // Brak contactId -> auto-link po adresie odbiorcy
            return this.conversations.logEmailAutoLink({
              userId: base.userId,
              direction: base.direction,
              subject: base.subject,
              body: base.body,
              date: base.date,
              emailId: base.emailId,
              counterpartEmail: base.counterpartEmail
            }).pipe(
              catchError(err => {
                console.warn('Log konwersacji (auto-link) nie zapisany', err);
                return of({ok: false} as any);
              }),
              map(() => saved)
            );
          })
        );
      })
    );
  }

  markAsRead(id: string): Observable<Email> {
    return this.http.patch<Email>(`${this.apiUrl}/${id}`, {isRead: true});
  }

  // --- utils ---

  private generateMessageId(): string {
    return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Znajduje wszystkie URL-e i dopina do nich parametry UTM.
   * Działa na prostym regexie.
   */
  private tagAllLinks(text: string, params: Record<string, string>): string {
    if (!text) return text;
    const urlRe = /\bhttps?:\/\/[^\s<>"']+/gi;
    return text.replace(urlRe, (url: string) => this.appendParams(url, params));
  }

  private appendParams(url: string, params: Record<string, string>): string {
    try {
      const u = new URL(url);
      Object.entries(params).forEach(([k, v]) => {
        // nie nadpisujemy istniejących UTM-ów, jeśli są
        if (!u.searchParams.has(k)) {
          u.searchParams.append(k, v);
        }
      });
      return u.toString();
    } catch {
      // gdy URL jest nietypowy (np. brak schematu) - zostawiamy bez zmian
      return url;
    }
  }

  /**
   * Zastępuje każdy URL adresem śledzącym:
   *   {origin}/api/t?m=<messageId>&u=<url>&r=<recipient>
   * gdzie {origin} to bieżąca domena aplikacji (Hosting proxy'uje /api do Functions).
   */
  private wrapWithTracking(text: string, messageId: string, recipient: string): string {
    if (!text) return text;
    const urlRe = /\bhttps?:\/\/[^\s<>"']+/gi;
    const base = this.getTrackingBaseUrl();
    return text.replace(urlRe, (url: string) => {
      // już śledzony?
      if (url.startsWith(base)) return url;
      try {
        const t = new URL(base);
        t.searchParams.set('m', messageId);
        t.searchParams.set('u', url);
        if (recipient) t.searchParams.set('r', recipient);
        return t.toString();
      } catch {
        return url;
      }
    });
  }

  private getTrackingBaseUrl(): string {
    try {
      return `${window.location.origin}/api/t`;
    } catch {
      return '/api/t';
    }
  }
}
