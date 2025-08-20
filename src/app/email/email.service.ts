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

  getEmails(): Observable<Email[]> {
    return this.http.get<Email[]>(this.apiUrl);
  }

  getEmail(id: string): Observable<Email> {
    return this.http.get<Email>(`${this.apiUrl}/${id}`);
  }

  /**
   * Wysyła (fizycznie przez backend) mail i – jeśli włączono – taguje wszystkie linki w treści.
   * Następnie zapisuje wiadomość w json-server (/api/emails) i loguje konwersację.
   *
   * Do każdego URL dodawane są parametry:
   *  utm_source=crm-app
   *  utm_medium=email
   *  utm_campaign=<subject>
   *  utm_content=<messageId>
   *  utm_recipient=<email odbiorcy>
   */
  sendEmail(
    email: Omit<Email, 'id' | 'date' | 'isRead'> & { trackLinks?: boolean }
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

    // Po sukcesie zapisz maila w json-server
    return send$.pipe(
      switchMap(() => {
        const payload: Omit<Email, 'id'> = {
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
      // Spróbuj zalogować konwersację (nie blokuje zwrotu)
      switchMap(saved =>
        this.auth.user$.pipe(
          take(1),
          switchMap(user => {
            if (!user) return of(saved);
            return this.conversations.logEmail({
              userId: user.uid,
              direction: 'out',
              subject: saved.subject,
              body: saved.body || '',
              date: saved.date,
              emailId: saved.id,
              counterpartEmail: saved.to
            }).pipe(
              catchError(err => {
                console.warn('⚠️ Log konwersacji nie zapisany', err);
                return of({ok: false} as any);
              }),
              map(() => saved)
            );
          })
        )
      )
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
