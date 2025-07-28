import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Slot} from '../slot.model';
import {SlotService} from '../slot.service';
import {DatePipe, NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-booking',
  imports: [
    NgIf,
    NgForOf,
    DatePipe
  ],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit {
  slots: Slot[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private slotService: SlotService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.slotService.getSlots().subscribe({
      next: slots => {
        this.slots = slots.filter(s => !s.booked);
        this.loading = false;
      },
      error: () => {
        this.error = 'Błąd ładowania dostępnych terminów';
        this.loading = false;
      }
    });
  }

  navigateToForm(slotId: string) {
    this.router.navigate(['/booking/form', slotId]);
  }
}
