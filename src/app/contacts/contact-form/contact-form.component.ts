import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent implements OnInit {
  form!: FormGroup;
  editId?: number;

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
      notes: ['']
    });

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.editId = +params['id'];
        this.contactService.getById(this.editId).subscribe(contact => {
          this.form.patchValue(contact);
        });
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const data = this.form.value as Omit<Contact, 'id'>;
    const op$ = this.editId
      ? this.contactService.update({id: this.editId, ...data})
      : this.contactService.create(data);

    op$.subscribe(() => this.router.navigate(['/contacts']));
  }
}
