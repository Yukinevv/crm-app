import {TestBed} from '@angular/core/testing';
import {EmailDetailComponent} from './email-detail.component';
import {EmailService} from '../email.service';
import {Email} from '../email.model';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';

function routeWithId(id: string | null) {
  return {
    snapshot: {
      paramMap: convertToParamMap(id ? {id} : {})
    }
  };
}

describe('EmailDetailComponent', () => {
  let emailSvc: jasmine.SpyObj<EmailService>;

  const MOCK_EMAIL: Email = {
    id: 'e1',
    from: 'nadawca@example.com',
    to: 'odbiorca@example.com',
    subject: 'Temat!',
    body: 'Cześć <b>Wiktor</b>\nhttps://example.com/oferta',
    date: '2024-01-01T12:00:00.000Z',
    isRead: false
  };

  beforeEach(() => {
    emailSvc = jasmine.createSpyObj<EmailService>('EmailService', [
      'getEmail',
      'markAsRead',
      'getEmails',
      'sendEmail'
    ]);
  });

  describe('z parametrem id', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [RouterTestingModule, EmailDetailComponent],
        providers: [
          {provide: EmailService, useValue: emailSvc},
          {provide: ActivatedRoute, useValue: routeWithId('e1')}
        ]
      }).compileComponents();
    });

    it('ładuje wiadomość po id i renderuje bezpieczny HTML (escape + linkifikacja + <br>)', () => {
      emailSvc.getEmail.and.returnValue(of(MOCK_EMAIL));

      const fixture = TestBed.createComponent(EmailDetailComponent);
      const comp = fixture.componentInstance;

      fixture.detectChanges(); // ngOnInit

      // wywołanie serwisu + podstawowe pola
      expect(emailSvc.getEmail).toHaveBeenCalledWith('e1');
      expect(comp.loading).toBeFalse();
      expect(comp.error).toBeNull();
      expect(comp.email?.subject).toBe('Temat!');

      // sprawdzamy wynik sanitize (SafeHtml) - odczyt prywatnego pola
      const html = (comp.bodyHtml as any).changingThisBreaksApplicationSecurity as string;
      expect(html).toContain('Cześć &lt;b&gt;Wiktor&lt;/b&gt;'); // <b> zostało zescape'owane
      expect(html).toContain('<br>'); // newline -> <br>
      expect(html).toContain(
        '<a href="https://example.com/oferta" target="_blank" rel="noopener noreferrer">https://example.com/oferta</a>'
      );
    });

    it('back(): nawigacja do /email', () => {
      emailSvc.getEmail.and.returnValue(of(MOCK_EMAIL));
      const fixture = TestBed.createComponent(EmailDetailComponent);
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate');

      fixture.detectChanges();

      comp.back();
      expect(navSpy).toHaveBeenCalledWith(['/email']);
    });

    it('obsługuje błąd z serwisu (ustawia error i wyłącza loading)', () => {
      emailSvc.getEmail.and.returnValue(throwError(() => new Error('boom')));

      const fixture = TestBed.createComponent(EmailDetailComponent);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(emailSvc.getEmail).toHaveBeenCalledWith('e1');
      expect(comp.loading).toBeFalse();
      expect(comp.error).toBe('Nie można wczytać wiadomości');
      expect(comp.email).toBeUndefined();
      expect(comp.bodyHtml).toBeNull();
    });
  });

  describe('bez parametru id', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [RouterTestingModule, EmailDetailComponent],
        providers: [
          {provide: EmailService, useValue: emailSvc},
          {provide: ActivatedRoute, useValue: routeWithId(null)}
        ]
      }).compileComponents();
    });

    it('ustawia komunikat o braku id i nie woła serwisu', () => {
      const fixture = TestBed.createComponent(EmailDetailComponent);
      const comp = fixture.componentInstance;

      fixture.detectChanges(); // ngOnInit

      expect(emailSvc.getEmail).not.toHaveBeenCalled();
      expect(comp.loading).toBeFalse();
      expect(comp.error).toBe('Nie wybrano wiadomości');
      expect(comp.email).toBeUndefined();
      expect(comp.bodyHtml).toBeNull();
    });
  });
});
