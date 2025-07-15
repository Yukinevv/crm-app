import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Contact} from '../contact.model';
import {ContactService} from '../contact.service';
import {RouterLink} from '@angular/router';
import {AsyncPipe, NgForOf} from '@angular/common';
import {Observable} from 'rxjs';
import {ImportExportService} from '../import-export.service';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [RouterLink, NgForOf, AsyncPipe],
  templateUrl: './contact-list.component.html'
})
export class ContactListComponent implements OnInit {
  contacts$!: Observable<Contact[]>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private contactService: ContactService,
    private ie: ImportExportService
  ) {
  }

  ngOnInit() {
    this.loadContacts();
  }

  loadContacts() {
    this.contacts$ = this.contactService.getAll();
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
