import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {ParseError, ParseResult} from 'papaparse';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';
import {PapaWrapperService} from './papa-wrapper.service';
import {XlsxWrapperService} from './xlsx-wrapper.service';
import {FileSaverWrapperService} from './file-saver-wrapper.service';
import {PdfWrapperService} from './pdf-wrapper.service';

@Injectable({providedIn: 'root'})
export class ImportExportService {
  constructor(
    private contactService: ContactService,
    private papa: PapaWrapperService,
    private xlsx: XlsxWrapperService,
    private fs: FileSaverWrapperService,
    private pdf: PdfWrapperService
  ) {
  }

  // ---- IMPORT ----

  importCSV(file: File): Promise<Contact[]> {
    return new Promise((resolve, reject) => {
      this.papa.parse<Contact>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: ParseResult<Contact>) => {
          try {
            const payloads = results.data.map(r => {
              const {id, ...rest} = r as any;
              return rest as Omit<Contact, 'id'>;
            });
            // każda create() zwraca Observable<Contact>, zamieniamy na Promise<Contact>
            const creationPromises = payloads.map(p =>
              firstValueFrom(this.contactService.create(p))
            );
            const createdContacts = await Promise.all(creationPromises);
            resolve(createdContacts);
          } catch (err) {
            reject(err);
          }
        },
        error: (error: Error, _file: File) => {
          reject(error as unknown as ParseError);
        }
      });
    });
  }

  importXLSX(file: File): Promise<Contact[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        try {
          const wb = this.xlsx.read(e.target.result, {type: 'binary'});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = this.xlsx.sheetToJson<Partial<Contact>>(ws, {
            defval: '',
            raw: false
          });
          const payloads = rows.map(r => {
            const {id, ...rest} = r as any;
            return rest as Omit<Contact, 'id'>;
          });
          const creationPromises = payloads.map(p =>
            firstValueFrom(this.contactService.create(p))
          );
          const createdContacts = await Promise.all(creationPromises);
          resolve(createdContacts);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  // ---- EXPORT ----

  exportCSV(contacts: Contact[]): void {
    const csv = this.papa.unparse(contacts);
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    this.fs.save(blob, 'contacts.csv');
  }

  exportXLSX(contacts: Contact[]): void {
    const ws = this.xlsx.jsonToSheet(contacts);
    const wb = this.xlsx.bookNew();
    this.xlsx.appendSheet(wb, ws, 'Contacts');
    const wbout = this.xlsx.write(wb, {bookType: 'xlsx', type: 'array'});
    const blob = new Blob([wbout], {type: 'application/octet-stream'});
    this.fs.save(blob, 'contacts.xlsx');
  }

  exportPDF(contacts: Contact[]): void {
    const doc = this.pdf.create();
    const columns = [
      'Imię', 'Nazwisko', 'Firma', 'Stanowisko',
      'Telefon', 'Email', 'Adres', 'Notatki'
    ];
    const rows = contacts.map(c => [
      c.firstName, c.lastName, c.company, c.position,
      c.phone, c.email, c.address, c.notes || ''
    ]);
    this.pdf.autoTable(doc, {head: [columns], body: rows});
    doc.save('contacts.pdf');
  }
}
