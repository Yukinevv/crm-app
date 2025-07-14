import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-contact-form',
  imports: [
    ReactiveFormsModule,
    NgIf
  ],
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent implements OnInit {
  form!: FormGroup;
  editId?: number;

  constructor(
    private formBuilder: FormBuilder,
    private contactService: ContactService,
    private route: ActivatedRoute,
    protected router: Router
  ) {
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
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
        const contact = this.contactService.getById(this.editId);
        if (contact) this.form.patchValue(contact);
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    const data = this.form.value as Omit<Contact, 'id'>;
    if (this.editId) {
      this.contactService.update({id: this.editId, ...data});
    } else {
      this.contactService.create(data);
    }
    this.router.navigate(['/contacts']);
  }
}
