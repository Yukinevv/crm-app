import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Contact} from '../contact.model';
import {ContactService} from '../contact.service';
import {RouterLink} from '@angular/router';
import {AsyncPipe, NgForOf} from '@angular/common';
import {combineLatest, map, Observable, startWith} from 'rxjs';
import {ImportExportService} from '../import-export.service';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [RouterLink, NgForOf, AsyncPipe, ReactiveFormsModule],
  templateUrl: './contact-list.component.html'
})
export class ContactListComponent implements OnInit {
  contacts$!: Observable<Contact[]>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  filteredContacts$!: Observable<Contact[]>;
  filterForm: FormGroup;

  availableStatuses = ['Nowy', 'Kontaktowany', 'Klient', 'Nieaktywny'];

  constructor(
    private contactService: ContactService,
    private ie: ImportExportService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      tags: [''],
      status: ['']
    });
  }

  ngOnInit() {
    this.loadContacts();

    this.filteredContacts$ = combineLatest([
      this.contacts$,
      this.filterForm.valueChanges.pipe(startWith(this.filterForm.value))
    ]).pipe(
      map(([list, filters]) => this.applyFilters(list, filters))
    );
  }

  loadContacts() {
    this.contacts$ = this.contactService.getAll();
  }

  private applyFilters(list: Contact[], filters: any): Contact[] {
    let result = list;
    const status = filters.status;
    const tagsRaw = filters.tags as string;
    if (status) {
      result = result.filter(c => c.status === status);
    }
    const tags = tagsRaw
      .split(',')
      .map(t => t.trim())
      .filter(t => !!t);
    if (tags.length) {
      result = result.filter(c =>
        tags.every(tag => c.tags?.includes(tag))
      );
    }
    return result;
  }

  onDelete(id: string) {
    if (confirm('Usunąć ten kontakt?')) {
      this.contactService.delete(id).subscribe(() => this.loadContacts());
    }
  }

  exportAll(format: 'csv' | 'xlsx' | 'pdf') {
    this.contactService.getAll().subscribe(list => {
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

  importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const fn = ext === 'csv'
      ? this.ie.importCSV(file)
      : this.ie.importXLSX(file);
    fn.then(() => {
      alert('Import zakończony pomyślnie');
      this.loadContacts();
      this.fileInput.nativeElement.value = '';
    }).catch(err => {
      console.error(err);
      alert('Błąd podczas importu');
    });
  }
}
