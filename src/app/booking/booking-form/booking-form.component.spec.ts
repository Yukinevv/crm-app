import {ComponentFixture, fakeAsync, flush, TestBed, tick} from '@angular/core/testing';
import {BookingFormComponent} from './booking-form.component';
import {ActivatedRoute, Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {SlotService} from '../slot.service';
import {BookingService} from '../booking.service';
import {Slot} from '../slot.model';

const mockSlot: Slot = {
  id: '123',
  start: '2025-08-10T10:00:00.000Z',
  end: '2025-08-10T11:00:00.000Z',
  booked: false
};

class MockSlotService {
  getSlot(id: string) {
    // Always return the mock slot immediately
    return of(mockSlot);
  }

  bookSlot = jasmine
    .createSpy('bookSlot')
    .and.returnValue(of({...mockSlot, booked: true}));
}

class MockBookingService {
  createBooking = jasmine
    .createSpy('createBooking')
    .and.returnValue(of({}));
}

describe('BookingFormComponent', () => {
  let component: BookingFormComponent;
  let fixture: ComponentFixture<BookingFormComponent>;
  let slotService: MockSlotService;
  let bookingService: MockBookingService;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    slotService = new MockSlotService();
    bookingService = new MockBookingService();

    await TestBed.configureTestingModule({
      // Import the standalone component directly
      imports: [BookingFormComponent],
      providers: [
        {provide: SlotService, useValue: slotService},
        {provide: BookingService, useValue: bookingService},
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {paramMap: {get: () => '123'}}
          }
        },
        {
          provide: Router,
          useValue: {navigate: jasmine.createSpy('navigate')}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingFormComponent);
    component = fixture.componentInstance;
    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
  });

  it('should initialize slot and form on init', () => {
    // Before detectChanges: loading true, form undefined
    expect(component.loading).toBeTrue();
    expect(component.form).toBeUndefined();

    // Trigger ngOnInit and subsequent rendering
    fixture.detectChanges(); // ngOnInit + sync getSlot
    fixture.detectChanges(); // update view

    expect(component.loading).toBeFalse();
    expect(component.form).toBeDefined();
    expect(component.slot).toEqual(mockSlot);
  });

  it('should disable submit button when form invalid', () => {
    fixture.detectChanges();
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBeTrue();
  });

  it('should enable submit button when form valid', () => {
    fixture.detectChanges();
    fixture.detectChanges();

    component.form.get('name')!.setValue('Jan Kowalski');
    component.form.get('email')!.setValue('jan@example.com');
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(component.form.valid).toBeTrue();
    expect(submitBtn.disabled).toBeFalse();
  });

  it('should display validation errors on touched invalid fields', () => {
    fixture.detectChanges();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    nameInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const nameError = fixture.nativeElement.querySelector(
      '.mb-3 .text-danger'
    ) as HTMLElement;
    expect(nameError.textContent).toContain('Pole jest wymagane');

    component.form.get('email')!.setValue('invalid-email');
    fixture.detectChanges();

    const emailInput = fixture.nativeElement.querySelector(
      'input[formControlName="email"]'
    ) as HTMLInputElement;
    emailInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const emailError = fixture.nativeElement.querySelector(
      '.mb-4 .text-danger'
    ) as HTMLElement;
    expect(emailError.textContent).toContain('Podaj poprawny email');
  });

  it('should submit form, mark submitted and navigate after delay', fakeAsync(() => {
    fixture.detectChanges();
    fixture.detectChanges();

    component.form.get('name')!.setValue('Anna Nowak');
    component.form.get('email')!.setValue('anna@example.com');
    fixture.detectChanges();

    // Submit the form
    const formEl = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    // Should call bookingService and then slotService
    expect(bookingService.createBooking).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'Rezerwacja: Anna Nowak',
        start: mockSlot.start,
        end: mockSlot.end
      })
    );
    expect(slotService.bookSlot).toHaveBeenCalledWith('123');

    // After the subscription
    tick();
    fixture.detectChanges();
    expect(component.submitted).toBeTrue();

    const successAlert = fixture.nativeElement.querySelector('.alert-success') as HTMLElement;
    expect(successAlert.textContent).toContain(
      'Twoja rezerwacja została zapisana'
    );

    // Should navigate after 3000ms
    tick(3000);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/booking']);
    flush();
  }));

  it('should set error when bookingService.createBooking errors', fakeAsync(() => {
    // Make bookingService throw
    (bookingService.createBooking as jasmine.Spy).and.returnValue(
      throwError(() => new Error('fail'))
    );

    fixture.detectChanges();
    fixture.detectChanges();

    component.form.get('name')!.setValue('Test User');
    component.form.get('email')!.setValue('test@example.com');
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit'));
    tick();
    fixture.detectChanges();

    expect(component.error).toBe('Błąd podczas rezerwacji. Spróbuj ponownie.');
    const errorEl = fixture.nativeElement.querySelector('.text-danger') as HTMLElement;
    expect(errorEl.textContent).toContain('Błąd podczas rezerwacji');
  }));

  it('should show "Brak wybranego terminu" if no ID in route', () => {
    // Override ActivatedRoute to simulate missing ID
    const stubRoute = TestBed.inject(ActivatedRoute) as any;
    stubRoute.snapshot.paramMap.get = () => null;

    // Re-create component so ngOnInit runs with no ID
    fixture = TestBed.createComponent(BookingFormComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.error).toBe('Brak wybranego terminu');
    const errorEl = fixture.nativeElement.querySelector('.text-danger') as HTMLElement;
    expect(errorEl.textContent).toContain('Brak wybranego terminu');
  });
});
