import {Injectable} from '@angular/core';
import {ContactService} from './contact.service';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {saveAs} from 'file-saver';
import {jsPDF} from 'jspdf';
import {Contact} from './contact.model';
import autoTable from 'jspdf-autotable';

@Injectable({providedIn: 'root'})
export class ImportExportService {
  constructor(private contactService: ContactService) {
  }

  // ------ IMPORT ------

  importCSV(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      Papa.parse<Contact>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: { data: any; }) => {
          try {
            for (const row of results.data) {
              await this.contactService.create(row).toPromise();
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        error: (err: any) => reject(err)
      });
    });
  }

  importXLSX(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        try {
          const wb = XLSX.read(e.target.result, {type: 'binary'});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data: Omit<Contact, 'id'>[] = XLSX.utils.sheet_to_json<Omit<Contact, 'id'>>(ws, {
            defval: '',
            raw: false
          });
          for (const c of data) {
            await this.contactService.create(c).toPromise();
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  // ------ EKSPORT ------

  exportCSV(contacts: Contact[]): void {
    const csv = Papa.unparse(contacts);
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    saveAs(blob, 'contacts.csv');
  }

  exportXLSX(contacts: Contact[]): void {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(contacts);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
    const blob = new Blob([wbout], {type: 'application/octet-stream'});
    saveAs(blob, 'contacts.xlsx');
  }

  exportPDF(contacts: Contact[]): void {
    const doc = new jsPDF();
    const columns = [
      'Imię', 'Nazwisko', 'Firma', 'Stanowisko', 'Telefon', 'Email', 'Adres', 'Notatki'
    ];
    const rows = contacts.map(c => [
      c.firstName, c.lastName, c.company, c.position,
      c.phone, c.email, c.address, c.notes || ''
    ]);
    autoTable(doc, {
      head: [columns],
      body: rows
    });
    doc.save('contacts.pdf');
  }
}
