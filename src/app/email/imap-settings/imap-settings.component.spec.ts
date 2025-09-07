import {TestBed} from '@angular/core/testing';
import {ImapSettingsComponent} from './imap-settings.component';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';
import {ImapConfigDto, ImapConfigView, ImapSettingsService} from '../imap-settings.service';
import {By} from '@angular/platform-browser';

class MockImapSettingsService {
  get = jasmine.createSpy('get').and.returnValue(
    of<ImapConfigView>({
      host: 'imap.example.com',
      port: 993,
      secure: true,
      user: 'user@example.com',
      mailbox: 'INBOX',
      hasPassword: true
    })
  );

  test = jasmine.createSpy('test').and.callFake((dto: ImapConfigDto) =>
    of({ok: true, mailboxes: ['INBOX', 'Archive'], sample: [{id: '1', subject: 'Hello'}]})
  );

  save = jasmine.createSpy('save').and.callFake((dto: ImapConfigDto) => of(dto));
}

describe('ImapSettingsComponent', () => {
  let fixture: any;
  let comp: ImapSettingsComponent;
  let svc: MockImapSettingsService;
  let alertSpy: jasmine.Spy<(message?: any) => void>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImapSettingsComponent, RouterTestingModule],
      providers: [{provide: ImapSettingsService, useClass: MockImapSettingsService}]
    }).compileComponents();

    fixture = TestBed.createComponent(ImapSettingsComponent);
    comp = fixture.componentInstance;
    svc = TestBed.inject(ImapSettingsService) as unknown as MockImapSettingsService;

    alertSpy = spyOn(window, 'alert').and.stub();
  });

  it('ngOnInit(): ładuje istniejącą konfigurację i ustawia formularz + hasPasswordOnServer', () => {
    fixture.detectChanges(); // uruchamia ngOnInit

    expect(svc.get).toHaveBeenCalled();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBeNull();
    expect(comp.hasPasswordOnServer).toBeTrue();

    // wartości w formularzu
    expect(comp.form.get('host')?.value).toBe('imap.example.com');
    expect(comp.form.get('port')?.value).toBe(993);
    expect(comp.form.get('secure')?.value).toBeTrue();
    expect(comp.form.get('user')?.value).toBe('user@example.com');
    expect(comp.form.get('mailbox')?.value).toBe('INBOX');

    // placeholder hasła - nie sprawdzamy DOM, wystarczy flaga
  });

  it('ngOnInit(): obsługuje błąd pobierania konfiguracji', () => {
    svc.get.and.returnValue(throwError(() => new Error('boom')));

    fixture = TestBed.createComponent(ImapSettingsComponent);
    comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.loading).toBeFalse();
    expect(comp.error).toBe('Nie udało się pobrać konfiguracji');
  });

  it('test(): wysyła DTO bez pola pass gdy input pass jest pusty', () => {
    fixture.detectChanges(); // załaduje defaultową konfigurację

    comp.form.get('pass')?.setValue('');
    expect(comp.form.valid).toBeTrue();

    comp.test();

    expect(comp.testing).toBeFalse();
    expect(svc.test).toHaveBeenCalled();

    const dtoArg = svc.test.calls.mostRecent().args[0] as ImapConfigDto;
    expect(dtoArg.host).toBe('imap.example.com');
    expect(dtoArg.user).toBe('user@example.com');
    expect(dtoArg.mailbox).toBe('INBOX');
    // nie dokładamy pass
    expect('pass' in dtoArg).toBeFalse();

    // wynik testu
    expect(comp.testResult).toEqual(
      jasmine.objectContaining({ok: true, mailboxes: ['INBOX', 'Archive']})
    );
  });

  it('test(): wysyła DTO z pass gdy input pass jest wypełniony', () => {
    fixture.detectChanges();

    comp.form.get('pass')?.setValue('sekret');

    comp.test();

    const dtoArg = svc.test.calls.mostRecent().args[0] as ImapConfigDto;
    expect(dtoArg.pass).toBe('sekret');
  });

  it('test(): ustawia error gdy serwis zwróci błąd i resetuje flagę testing', () => {
    fixture.detectChanges();
    svc.test.and.returnValue(throwError(() => new Error('bad')));

    comp.test();

    expect(comp.testing).toBeFalse();
    expect(comp.error).toBe('Test połączenia nieudany');
    expect(comp.testResult).toBeNull();
  });

  it('save(): zapisuje DTO (z pass jeśli podano), resetuje pass i ustawia hasPasswordOnServer', () => {
    fixture.detectChanges();

    // Podaj nowe hasło
    comp.form.patchValue({
      host: 'imap.example.com',
      port: 993,
      secure: true,
      user: 'user@example.com',
      mailbox: 'INBOX',
      pass: 'NOWE_HASLO'
    });

    comp.save();

    expect(svc.save).toHaveBeenCalled();
    const dtoArg = svc.save.calls.mostRecent().args[0] as ImapConfigDto;
    expect(dtoArg.pass).toBe('NOWE_HASLO');

    expect(comp.saving).toBeFalse();
    expect(comp.hasPasswordOnServer).toBeTrue();
    expect(comp.form.get('pass')?.value).toBeNull(); // reset po zapisie
    expect(alertSpy).toHaveBeenCalledWith('Zapisano konfigurację IMAP');
  });

  it('save(): bez podanego pass nie dodaje pola pass do DTO', () => {
    fixture.detectChanges();

    comp.form.patchValue({
      pass: ''
    });

    comp.save();

    const dtoArg = svc.save.calls.mostRecent().args[0] as ImapConfigDto;
    expect('pass' in dtoArg).toBeFalse();
  });

  it('save(): obsługuje błąd zapisu', () => {
    fixture.detectChanges();
    svc.save.and.returnValue(throwError(() => new Error('save-fail')));

    comp.save();

    expect(comp.saving).toBeFalse();
    expect(comp.error).toBe('Nie udało się zapisać konfiguracji');
  });

  it('formularz: podstawowa walidacja wymaganych pól', () => {
    fixture.detectChanges();

    comp.form.get('host')?.setValue('');
    comp.form.get('user')?.setValue('');
    comp.form.get('mailbox')?.setValue('');

    expect(comp.form.valid).toBeFalse();
  });

  it('przyciski: są disabled gdy formularz niepoprawny', () => {
    fixture.detectChanges();

    comp.form.get('host')?.setValue('');
    fixture.detectChanges();

    const saveBtn = fixture.debugElement.query(By.css('button.btn.btn-primary')).nativeElement as HTMLButtonElement;
    const testBtn = fixture.debugElement.query(By.css('button.btn.btn-outline-secondary')).nativeElement as HTMLButtonElement;

    expect(saveBtn.disabled).toBeTrue();
    expect(testBtn.disabled).toBeTrue();
  });
});
