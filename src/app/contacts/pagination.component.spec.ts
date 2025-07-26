import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PaginationComponent} from './pagination.component';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('powinien utworzyć komponent', () => {
    expect(component).toBeTruthy();
  });

  describe('totalPages', () => {
    it('powinien poprawnie obliczać całkowitą liczbę stron', () => {
      component.totalItems = 25;
      component.pageSize = 5;
      expect(component.totalPages).toBe(5);
    });

    it('powinien zwracać 1 gdy nie ma elementów', () => {
      component.totalItems = 0;
      component.pageSize = 5;
      expect(component.totalPages).toBe(1);
    });

    it('powinien zaokrąglać w górę gdy liczba elementów nie dzieli się równo', () => {
      component.totalItems = 22;
      component.pageSize = 5;
      expect(component.totalPages).toBe(5);
    });
  });

  describe('pages', () => {
    it('powinien generować poprawną tablicę numerów stron', () => {
      component.totalItems = 15;
      component.pageSize = 5;
      expect(component.pages).toEqual([1, 2, 3]);
    });

    it('powinien zwracać [1] gdy jest tylko jedna strona', () => {
      component.totalItems = 5;
      component.pageSize = 5;
      expect(component.pages).toEqual([1]);
    });
  });

  describe('setPage', () => {
    it('powinien emitować nowy numer strony', () => {
      const spy = spyOn(component.currentPageChange, 'emit');
      component.totalItems = 25;
      component.pageSize = 5;
      component.currentPage = 1;

      component.setPage(3);

      expect(spy).toHaveBeenCalledWith(3);
      expect(component.currentPage).toBe(3);
    });

    it('nie powinien emitować gdy strona jest poza zakresem', () => {
      const spy = spyOn(component.currentPageChange, 'emit');
      component.totalItems = 25;
      component.pageSize = 5;
      component.currentPage = 1;

      component.setPage(6);

      expect(spy).not.toHaveBeenCalled();
      expect(component.currentPage).toBe(1);
    });

    it('nie powinien emitować gdy wybrano aktualną stronę', () => {
      const spy = spyOn(component.currentPageChange, 'emit');
      component.totalItems = 25;
      component.pageSize = 5;
      component.currentPage = 2;

      component.setPage(2);

      expect(spy).not.toHaveBeenCalled();
      expect(component.currentPage).toBe(2);
    });

    it('nie powinien emitować dla strony mniejszej niż 1', () => {
      const spy = spyOn(component.currentPageChange, 'emit');
      component.totalItems = 25;
      component.pageSize = 5;
      component.currentPage = 2;

      component.setPage(0);

      expect(spy).not.toHaveBeenCalled();
      expect(component.currentPage).toBe(2);
    });
  });

  describe('template', () => {
    it('powinien wyświetlać prawidłową liczbę przycisków stron', () => {
      component.totalItems = 15;
      component.pageSize = 5;
      fixture.detectChanges();

      const buttons = fixture.debugElement.nativeElement.querySelectorAll('.page-link');
      // 5 przycisków: Perwsza, Poprzednia, 3 strony, Następna, Ostatnia
      expect(buttons.length).toBe(7);
    });

    it('powinien dezaktywować przyciski Previous i First na pierwszej stronie', () => {
      component.totalItems = 15;
      component.pageSize = 5;
      component.currentPage = 1;
      fixture.detectChanges();

      const firstButton = fixture.debugElement.nativeElement.querySelector('li:first-child button');
      const previousButton = fixture.debugElement.nativeElement.querySelector('li:nth-child(2) button');

      expect(firstButton.disabled).toBeTrue();
      expect(previousButton.disabled).toBeTrue();
    });

    it('powinien dezaktywować przyciski Next i Last na ostatniej stronie', () => {
      component.totalItems = 15;
      component.pageSize = 5;
      component.currentPage = 3;
      fixture.detectChanges();

      const nextButton = fixture.debugElement.nativeElement.querySelector('li:nth-last-child(2) button');
      const lastButton = fixture.debugElement.nativeElement.querySelector('li:last-child button');

      expect(nextButton.disabled).toBeTrue();
      expect(lastButton.disabled).toBeTrue();
    });
  });
});
