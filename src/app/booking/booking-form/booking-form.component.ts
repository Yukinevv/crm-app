import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Slot} from '../slot.model';
import {SlotService} from '../slot.service';
import {BookingService} from '../booking.service';
import {DatePipe, NgIf} from '@angular/common';
import {Functions, httpsCallable} from "@angular/fire/functions";
import {from} from "rxjs";

@Component({
  selector: 'app-booking-form',
  imports: [
    NgIf,
    DatePipe,
    ReactiveFormsModule
  ],
  templateUrl: './booking-form.component.html'
})
export class BookingFormComponent implements OnInit {
  form!: FormGroup;
  slot!: Slot;
  loading = true;
  error: string | null = null;
  submitted = false;

  constructor(
      private fb: FormBuilder,
      private route: ActivatedRoute,
      private slotService: SlotService,
      private bookingService: BookingService,
      protected router: Router,
      private functions: Functions
  ) {
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Brak wybranego terminu';
      this.loading = false;
      return;
    }

    this.slotService.getSlot(id).subscribe({
      next: slot => {
        this.slot = slot;
        this.form = this.fb.group({
          name: ['', Validators.required],
          email: ['', [Validators.required, Validators.email]]
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'Nie znaleziono wybranego terminu';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const {name, email} = this.form.value;
    const evt = {
      title: `Rezerwacja: ${name}`,
      participants: [],
      location: '',
      virtualLink: '',
      start: this.slot.start,
      end: this.slot.end,
      allDay: false,
      reminderMinutesBefore: 0
    };

    this.bookingService.createBooking(evt).subscribe({
      next: () => {
        this.slotService.bookSlot(this.slot.id).subscribe(() => {
          this.sendConfirmationEmail(email, this.slot.start, this.slot.end);
          this.submitted = true;
          setTimeout(() => this.router.navigate(['/booking']), 3000);
        });
      },
      error: () => {
        this.error = 'Błąd podczas rezerwacji. Spróbuj ponownie.';
      }
    });
  }

  private sendConfirmationEmail(userEmail: string, start: string, end: string): void {
    const fn = httpsCallable<{ email: string; start: string; end: string }, { success: boolean }>(
        this.functions,
        'sendBookingConfirmation'
    );
    from(fn({email: userEmail, start, end}))
        .subscribe({
          next: () => {
            console.log('Potwierdzenie mailowe wysłane');
          },
          error: err => {
            console.error('Błąd wysyłki maila potwierdzającego', err);
          }
        });
  }
}
