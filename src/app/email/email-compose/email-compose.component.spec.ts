import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {EmailComposeComponent} from './email-compose.component';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {of, throwError} from 'rxjs';
import {EmailService} from '../email.service';
import {TemplateService} from '../template.service';
import {AuthService} from '../../auth/auth.service';

// ===== Mocks =====
class MockEmailService {
  sendEmail = jasmine.createSpy('sendEmail').and.returnValue(
    of({
      id: 'e1',
      from: 'me@test.local',
      to: 'john@example.com',
      subject: 'Temat',
      body: 'Treść',
      date: new Date().toISOString(),
      isRead: false,
      messageId: 'm_1'
    })
  );
}

class MockTemplateService {
  getTemplates = jasmine.createSpy('getTemplates').and.returnValue(
    of([
      {id: 'tpl1', name: 'Welcome', subject: 'Hi {{name}}', body: 'Meet on {{date}} at {{time}}'},
      {id: 'tpl2', name: 'Follow-up', subject: 'Re: {{topic}}', body: 'Ping'}
    ])
  );

  getTemplate = jasmine.createSpy('getTemplate').and.callFake((id: string) => {
    if (id === 'tpl1') {
      return of({id: 'tpl1', name: 'Welcome', subject: 'Hi {{name}}', body: 'Meet on {{date}} at {{time}}'});
    }
    if (id === 'tpl2') {
      return of({id: 'tpl2', name: 'Follow-up', subject: 'Re: {{topic}}', body: 'Ping'});
    }
    return of({id, name: 'X', subject: '', body: ''});
  });
}

// prosty mock AuthService - tylko user$
const mockAuthService: Partial<AuthService> = {
  user$: of({uid: 'u-TEST', email: 'me@test.local'} as any),
};

// ActivatedRoute stub (będziemy podmieniać queryParamMap PRZED createComponent)
const routeStub: any = {
  snapshot: {queryParamMap: convertToParamMap({})},
};

describe('EmailComposeComponent', () => {
  let router: Router;
  let email: MockEmailService;
  let templates: MockTemplateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailComposeComponent, RouterTestingModule],
      providers: [
        {provide: EmailService, useClass: MockEmailService},
        {provide: TemplateService, useClass: MockTemplateService},
        {provide: AuthService, useValue: mockAuthService},
        {provide: ActivatedRoute, useValue: routeStub},
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    email = TestBed.inject(EmailService) as unknown as MockEmailService;
    templates = TestBed.inject(TemplateService) as unknown as MockTemplateService;
  });

  it('powinien załadować listę szablonów w ngOnInit', () => {
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(templates.getTemplates).toHaveBeenCalled();
    expect(comp.templates.length).toBe(2);
  });

  it('prefill z query params wyłącza auto-sync dla subject/body gdy zostały dostarczone', () => {
    // podmień queryParamMap PRZED utworzeniem komponentu
    routeStub.snapshot.queryParamMap = convertToParamMap({
      to: 'john@example.com',
      subject: 'Re: Oferta',
      body: '--- cytat ---',
    });

    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;

    fixture.detectChanges();

    expect(comp.form.get('to')?.value).toBe('john@example.com');
    expect(comp.form.get('subject')?.value).toBe('Re: Oferta');
    expect(comp.form.get('body')?.value).toBe('--- cytat ---');

    // auto-sync powinien być wyłączony, bo subject i body przyszły z URL
    expect(comp.syncSubject).toBeFalse();
    expect(comp.syncBody).toBeFalse();
  });

  it('wybór szablonu buduje zmienne i auto-aktualizuje subject/body (gdy sync włączony)', fakeAsync(() => {
    // brak prefill
    routeStub.snapshot.queryParamMap = convertToParamMap({});

    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit -> pobranie listy szablonów

    // wybierz tpl1
    comp.form.get('templateId')!.setValue('tpl1');
    tick(); // poczekaj aż .getTemplate zadziała

    // powstały klucze i typy
    expect(comp.placeholderKeys.sort()).toEqual(['date', 'name', 'time'].sort());
    expect(comp.variableTypes['date']).toBe('date');
    expect(comp.variableTypes['time']).toBe('time');
    expect(comp.variableTypes['name']).toBe('text');

    // inicjalnie puste wartości - subject/body powinny się zapełnić szablonem bez wartości
    expect(comp.form.get('subject')!.value).toBe('Hi ');
    expect(comp.form.get('body')!.value).toContain('Meet on ');
    expect(comp.form.get('body')!.value).toContain(' at ');

    // ustaw zmienne - auto-sync powinien natychmiast nadpisać pola
    const vars = comp.form.get('variables')!;
    vars.patchValue({name: 'Ala', date: '2025-08-09', time: '14:00'});
    tick();

    expect(comp.form.get('subject')!.value).toBe('Hi Ala');
    const bodyVal = comp.form.get('body')!.value as string;
    expect(bodyVal).not.toContain('{{date}}');
    expect(bodyVal).not.toContain('{{time}}');
    expect(bodyVal).toContain('14:00'); // nie testujemy formatowania PL, tylko że podmiana zaszła
  }));

  it('ręczna edycja subject/body wyłącza auto-sync', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.syncSubject).toBeTrue();
    expect(comp.syncBody).toBeTrue();

    comp.form.get('subject')!.setValue('Ręcznie');
    comp.form.get('body')!.setValue('Manual');
    // subscriptions w ngOnInit powinny zadziałać:
    expect(comp.syncSubject).toBeFalse();
    expect(comp.syncBody).toBeFalse();
  });

  it('applyTemplateNow nadpisuje pole mimo wyłączonego sync', fakeAsync(() => {
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // wybierz tpl2
    comp.form.get('templateId')!.setValue('tpl2');
    tick();

    // wyłącz sync i wpisz własny temat
    comp.syncSubject = false;
    comp.form.get('variables')!.patchValue({topic: 'Demo'});
    tick();
    comp.form.get('subject')!.setValue('Moje');
    expect(comp.form.get('subject')!.value).toBe('Moje');

    // applyTemplateNow powinno nadpisać temat mimo sync=false
    comp.applyTemplateNow('subject');
    expect(comp.form.get('subject')!.value).toBe('Re: Demo');
  }));

  it('onToggleSync włącza sync i natychmiast nadpisuje wartość z szablonu', fakeAsync(() => {
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.form.get('templateId')!.setValue('tpl2');
    tick();

    // ustaw zmienne + ręcznie ustaw subjekta
    comp.form.get('variables')!.patchValue({topic: 'Test'});
    tick();
    comp.syncSubject = false;
    comp.form.get('subject')!.setValue('Manual');

    // włącz sync -> powinno pobrać z szablonu
    comp.onToggleSync('subject', true);
    expect(comp.syncSubject).toBeTrue();
    expect(comp.form.get('subject')!.value).toBe('Re: Test');
  }));

  it('send() – sukces: wywołuje EmailService i przechodzi do /email', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const navSpy = spyOn(router, 'navigate').and.stub();

    // uzupełnij poprawnie formularz
    comp.form.patchValue({
      to: 'john@example.com',
      subject: 'Temat',
      body: 'Treść',
      trackLinks: true,
    });

    comp.send();

    expect(email.sendEmail).toHaveBeenCalledWith(
      jasmine.objectContaining({
        from: 'me@test.local',
        to: 'john@example.com',
        subject: 'Temat',
        body: 'Treść',
        trackLinks: true,
      })
    );
    expect(navSpy).toHaveBeenCalledWith(['/email']);
    expect(comp.error).toBeNull();
  });

  it('send() – błąd: ustawia error i resetuje sending', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    // Wymuś błąd wysyłki
    (email.sendEmail as any).and.returnValue(throwError(() => new Error('boom')));

    comp.form.patchValue({
      to: 'john@example.com',
      subject: 'Temat',
      body: 'Treść',
    });

    comp.send();

    expect(comp.error).toBe('Błąd wysyłki wiadomości');
    expect(comp.sending).toBeFalse();
  });

  it('cancel() – nawigacja do /email', () => {
    const fixture = TestBed.createComponent(EmailComposeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const navSpy = spyOn(router, 'navigate').and.stub();
    comp.cancel();
    expect(navSpy).toHaveBeenCalledWith(['/email']);
  });
});
