import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';
import {NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgForOf],
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent implements OnInit {
  form!: FormGroup;
  editId?: string;

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private route: ActivatedRoute,
    protected router: Router
  ) {
  }

  ngOnInit() {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: [''],
      position: [''],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      notes: [''],
      tags: [''],
      status: ['']
    });

    this.route.paramMap.subscribe(pm => {
      const id = pm.get('id');
      if (id) {
        this.editId = id;
        console.log('Ładowanie kontaktu o id =', id);
        this.contactService.getById(id)
          .subscribe(contact => this.form.patchValue(contact));
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const raw = this.form.value;
    const data: Omit<Contact, 'id'> = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      company: raw.company,
      position: raw.position,
      phone: raw.phone,
      email: raw.email,
      address: raw.address,
      notes: raw.notes,
      tags: raw.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => !!t),
      status: raw.status
    };

    const op$ = this.editId
      ? this.contactService.update({id: this.editId, ...data})
      : this.contactService.create(data);

    op$.subscribe(() => this.router.navigate(['/contacts']));
  }
}
