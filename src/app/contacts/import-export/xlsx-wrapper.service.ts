import {Injectable} from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({providedIn: 'root'})
export class XlsxWrapperService {
  read(data: string | ArrayBuffer, opts: XLSX.ParsingOptions): XLSX.WorkBook {
    return XLSX.read(data, opts);
  }

  sheetToJson<T>(ws: XLSX.WorkSheet, opts: XLSX.Sheet2JSONOpts = {}): T[] {
    return XLSX.utils.sheet_to_json<T>(ws, opts);
  }

  jsonToSheet(data: any[]): XLSX.WorkSheet {
    return XLSX.utils.json_to_sheet(data);
  }

  bookNew(): XLSX.WorkBook {
    return XLSX.utils.book_new();
  }

  appendSheet(wb: XLSX.WorkBook, ws: XLSX.WorkSheet, name: string): void {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  write(wb: XLSX.WorkBook, opts: XLSX.WritingOptions): string | Uint8Array {
    return XLSX.write(wb, opts);
  }
}
