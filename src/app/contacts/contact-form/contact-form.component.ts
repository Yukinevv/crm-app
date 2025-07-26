import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';
import {NgForOf, NgIf} from '@angular/common';
import {AuthService} from '../../auth/auth.service';
import {take} from 'rxjs';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgForOf],
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent implements OnInit {
  form!: FormGroup;
  editId?: string;
  contactsList: Contact[] = [];

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private route: ActivatedRoute,
    protected router: Router,
    private auth: AuthService
  ) {
  }

  ngOnInit() {
    this.contactService.getAll().subscribe(list => {
      this.contactsList = list;
    });

    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: [''],
      companyId: [''],
      position: [''],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      notes: [''],
      tags: [''],
      status: [''],
      createdAt: [''],
      source: [''],
      region: [''],
      managerId: [''],
      decisionMakerId: ['']
    });

    this.route.paramMap.subscribe(pm => {
      const id = pm.get('id');
      if (id) {
        this.editId = id;
        this.contactService.getById(id).subscribe(contact => {
          this.form.patchValue({
            ...contact,
            // zamieniamy tablicę tagów na ciąg "tag1, tag2"
            tags: contact.tags?.length ? contact.tags.join(', ') : '',
            createdAt: contact.createdAt.substring(0, 16)
          });
        });
      } else {
        const now = new Date().toISOString();
        this.form.get('createdAt')!.setValue(now.substring(0, 16));
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    // bierzemy aktualnie zalogowanego użytkownika raz
    this.auth.user$.pipe(take(1)).subscribe(user => {
      if (!user) {
        alert('Musisz być zalogowany, aby zapisać kontakt');
        return;
      }

      const raw = this.form.value;
      const data: Omit<Contact, 'id'> & { userId: string } = {
        firstName: raw.firstName,
        lastName: raw.lastName,
        company: raw.company,
        companyId: raw.companyId || undefined,
        position: raw.position,
        phone: raw.phone,
        email: raw.email,
        address: raw.address,
        notes: raw.notes,
        tags: this.tagsSplit(raw.tags),
        status: raw.status,
        createdAt: new Date(raw.createdAt).toISOString(),
        source: raw.source,
        region: raw.region,
        managerId: raw.managerId || undefined,
        decisionMakerId: raw.decisionMakerId || undefined,
        userId: user.uid
      };

      const op$ = this.editId
        ? this.contactService.update({id: this.editId, ...data})
        : this.contactService.create(data);

      op$.subscribe(() => this.router.navigate(['/contacts']));
    });
  }

  tagsSplit(tags: string | string[]): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) {
      return tags;
    }
    const tagStr = tags as string;
    return tagStr.includes(',')
      ? tagStr.split(',').map(t => t.trim()).filter(t => !!t)
      : [tagStr.trim()];
  }
}
