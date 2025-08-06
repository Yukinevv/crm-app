import {Injectable} from '@angular/core';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({providedIn: 'root'})
export class PdfWrapperService {
  create(): jsPDF {
    return new jsPDF();
  }

  autoTable(doc: jsPDF, options: Parameters<typeof autoTable>[1]): void {
    autoTable(doc, options);
  }
}
