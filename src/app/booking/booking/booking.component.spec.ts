import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {BookingComponent} from './booking.component';
import {SlotService} from '../slot.service';
import {Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {Slot} from '../slot.model';

describe('BookingComponent', () => {
  let component: BookingComponent;
  let fixture: ComponentFixture<BookingComponent>;
  let mockSlotService: jasmine.SpyObj<SlotService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockSlotService = jasmine.createSpyObj('SlotService', ['getSlots']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [BookingComponent], // standalone
      providers: [
        {provide: SlotService, useValue: mockSlotService},
        {provide: Router, useValue: mockRouter}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingComponent);
    component = fixture.componentInstance;
  });

  it('powinien utworzyć komponent', () => {
    expect(component).toBeTruthy();
    // stan początkowy przed detectChanges
    expect(component.loading).toBeTrue();
    expect(component.slots).toEqual([]);
    expect(component.error).toBeNull();
  });

  it('powinien załadować niezarezerwowane sloty i ustawić loading=false', fakeAsync(() => {
    const sampleSlots: Slot[] = [
      {id: '1', start: '2025-08-20T10:00:00', end: '2025-08-20T11:00:00', booked: false},
      {id: '2', start: '2025-08-21T10:00:00', end: '2025-08-21T11:00:00', booked: true}
    ];
    mockSlotService.getSlots.and.returnValue(of(sampleSlots));

    fixture.detectChanges(); // wywołuje ngOnInit
    tick();                  // flushuje subskrypcję

    expect(component.loading).toBeFalse();
    expect(component.error).toBeNull();
    expect(component.slots.length).toBe(1);
    expect(component.slots[0].id).toBe('1');
  }));

  it('powinien obsłużyć błąd przy ładowaniu i ustawić komunikat', fakeAsync(() => {
    mockSlotService.getSlots.and.returnValue(throwError(() => new Error('fail')));

    fixture.detectChanges();
    tick();

    expect(component.loading).toBeFalse();
    expect(component.slots).toEqual([]);
    expect(component.error).toBe('Błąd ładowania dostępnych terminów');
  }));

  it('navigateToForm powinien nawigować do formularza z podanym id', () => {
    component.navigateToForm('abc123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/booking/form', 'abc123']);
  });
});
