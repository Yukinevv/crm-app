import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Contact} from '../contact.model';
import {ContactService} from '../contact.service';
import {RouterLink} from '@angular/router';
import {AsyncPipe, DatePipe, NgForOf, NgIf} from '@angular/common';
import {debounceTime, Observable} from 'rxjs';
import {ImportExportService} from '../import-export/import-export.service';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {PaginationComponent} from '../pagination.component';
import {AuthService} from '../../auth/auth.service';
import {User} from 'firebase/auth';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [RouterLink, NgForOf, ReactiveFormsModule, DatePipe, PaginationComponent, NgIf, AsyncPipe],
  templateUrl: './contact-list.component.html'
})
export class ContactListComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  filterForm: FormGroup;
  contacts: Contact[] = [];
  filteredContacts: Contact[] = [];

  currentPage = 1;
  pageSize = 5;

  get pagedContacts(): Contact[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredContacts.slice(start, start + this.pageSize);
  }

  user$: Observable<User | null>;

  availableStatuses = ['Nowy', 'Kontaktowany', 'Klient', 'Nieaktywny'];

  constructor(
    private cs: ContactService,
    private ie: ImportExportService,
    private fb: FormBuilder,
    private auth: AuthService
  ) {
    this.user$ = this.auth.user$;
    this.filterForm = this.fb.group({
      q: [''],
      tags: [''],
      status: [''],
      dateFrom: [''],
      dateTo: [''],
      source: [''],
      region: ['']
    });
  }

  ngOnInit() {
    this.loadContacts();

    this.filterForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(() => this.applyFilters());
  }

  private loadContacts() {
    this.cs.getAll().subscribe(list => {
      this.contacts = list;
      this.applyFilters();
    });
  }

  private applyFilters() {
    const f = this.filterForm.value;
    this.filteredContacts = this.applyClientFilters(this.contacts, f);
    // po zmianie filtrów wracamy na stronę 1
    this.currentPage = 1;
  }

  private applyClientFilters(list: Contact[], f: any): Contact[] {
    let res = list;

    // pełnotekstowe wyszukiwanie (firstName, lastName, company, notes)
    if (f.q) {
      const q = f.q.toLowerCase();
      res = res.filter(c =>
        c.firstName?.toLowerCase().includes(q) ||
        c.lastName?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
    }

    // status (dokładne dopasowanie)
    if (f.status) {
      res = res.filter(c => c.status === f.status);
    }

    // źródło lejka (częściowe, case-insensitive)
    if (f.source) {
      const src = f.source.toLowerCase();
      res = res.filter(c => c.source?.toLowerCase().includes(src));
    }

    // region (częściowe, case-insensitive)
    if (f.region) {
      const reg = f.region.toLowerCase();
      res = res.filter(c => c.region?.toLowerCase().includes(reg));
    }

    // data dodania
    if (f.dateFrom) {
      const from = new Date(f.dateFrom);
      res = res.filter(c => new Date(c.createdAt) >= from);
    }
    if (f.dateTo) {
      const to = new Date(f.dateTo);
      to.setHours(23, 59, 59, 999);
      res = res.filter(c => new Date(c.createdAt) <= to);
    }

    // tagi (wszystkie muszą wystąpić)
    const tags = f.tags
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: any) => !!t);
    if (tags.length) {
      res = res.filter(c => tags.every((tag: string) => c.tags?.includes(tag)));
    }

    return res;
  }

  getContactName(id?: string) {
    const c = this.contacts.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }

  onDelete(id: string) {
    if (!confirm('Usunąć ten kontakt?')) return;
    this.cs.delete(id).subscribe(() => {
      this.contacts = this.contacts.filter(c => c.id !== id);
      this.applyFilters();
    });
  }

  exportAll(format: 'csv' | 'xlsx' | 'pdf') {
    this.cs.getAll().subscribe(list => {
      switch (format) {
        case 'csv':
          this.ie.exportCSV(list);
          break;
        case 'xlsx':
          this.ie.exportXLSX(list);
          break;
        case 'pdf':
          this.ie.exportPDF(list);
          break;
      }
    });
  }

  importFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    let importPromise: Promise<Contact[]>;

    if (ext === 'csv') {
      importPromise = this.ie.importCSV(file);
    } else if (ext === 'xlsx') {
      importPromise = this.ie.importXLSX(file);
    } else {
      alert('Nieobsługiwany format pliku');
      return;
    }

    importPromise
      .then(createdContacts => {
        this.contacts = [...this.contacts, ...createdContacts];
        this.applyFilters();
        alert('Import zakończony');
      })
      .catch(() => {
        alert('Błąd podczas importu');
      })
      .finally(() => {
        this.fileInput.nativeElement.value = '';
      });
  }
}
