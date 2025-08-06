import {TestBed} from '@angular/core/testing';
import {ImportExportService} from './import-export.service';
import {PapaWrapperService} from './papa-wrapper.service';
import {XlsxWrapperService} from './xlsx-wrapper.service';
import {FileSaverWrapperService} from './file-saver-wrapper.service';
import {PdfWrapperService} from './pdf-wrapper.service';
import {of, throwError} from 'rxjs';
import {ContactService} from '../contact.service';
import {Contact} from '../contact.model';

class FakeFileReader {
  onload: ((e: any) => void) | null = null;

  readAsBinaryString(_file: any) {
    if (this.onload) {
      this.onload({target: {result: 'BINARY_DATA'}});
    }
  }
}

describe('ImportExportService', () => {
  let service: ImportExportService;
  let contactService: jasmine.SpyObj<ContactService>;
  let papa: jasmine.SpyObj<PapaWrapperService>;
  let xlsx: jasmine.SpyObj<XlsxWrapperService>;
  let fs: jasmine.SpyObj<FileSaverWrapperService>;
  let pdf: jasmine.SpyObj<PdfWrapperService>;

  beforeEach(() => {
    contactService = jasmine.createSpyObj('ContactService', ['create']);
    papa = jasmine.createSpyObj('PapaWrapperService', ['parse', 'unparse']);
    xlsx = jasmine.createSpyObj('XlsxWrapperService', [
      'read', 'sheetToJson', 'jsonToSheet', 'bookNew', 'appendSheet', 'write'
    ]);
    fs = jasmine.createSpyObj('FileSaverWrapperService', ['save']);
    pdf = jasmine.createSpyObj('PdfWrapperService', ['create', 'autoTable']);

    TestBed.configureTestingModule({
      providers: [
        ImportExportService,
        {provide: ContactService, useValue: contactService},
        {provide: PapaWrapperService, useValue: papa},
        {provide: XlsxWrapperService, useValue: xlsx},
        {provide: FileSaverWrapperService, useValue: fs},
        {provide: PdfWrapperService, useValue: pdf},
      ]
    });
    service = TestBed.inject(ImportExportService);
  });

  describe('importCSV', () => {
    it('should parse and create contacts', async () => {
      papa.parse.and.callFake((file, cfg: any) => {
        cfg.complete({
          data: [
            {firstName: 'A', lastName: 'B'},
            {firstName: 'X', lastName: 'Y'}
          ]
        });
      });
      contactService.create.and.returnValue(of({} as Contact));

      await service.importCSV(new File([''], 'c.csv'));

      expect(papa.parse).toHaveBeenCalled();
      expect(contactService.create).toHaveBeenCalledWith(
        jasmine.objectContaining({firstName: 'A', lastName: 'B'})
      );
      expect(contactService.create).toHaveBeenCalledTimes(2);
    });

    it('should reject on parse error', async () => {
      papa.parse.and.callFake((_f, cfg: any) => {
        cfg.error('err');
      });
      await expectAsync(service.importCSV(new File([''], 'c.csv')))
        .toBeRejectedWith('err');
    });

    it('should reject if create throws', async () => {
      papa.parse.and.callFake((_f, cfg: any) => {
        cfg.complete({data: [{firstName: 'Z', lastName: 'W'}]});
      });
      contactService.create.and.returnValue(throwError(() => new Error('fail')));
      await expectAsync(service.importCSV(new File([''], 'c.csv')))
        .toBeRejectedWithError('fail');
    });
  });

  describe('importXLSX', () => {
    let origFR: any;
    beforeEach(() => {
      origFR = (window as any).FileReader;
      (window as any).FileReader = FakeFileReader;

      xlsx.read.and.returnValue({SheetNames: ['S'], Sheets: {S: {}}} as any);
      xlsx.sheetToJson.and.returnValue([{firstName: 'M', lastName: 'N'}]);
      contactService.create.and.returnValue(of({} as Contact));
    });
    afterEach(() => {
      (window as any).FileReader = origFR;
    });

    it('should read and create contacts', async () => {
      await service.importXLSX(new File([''], 'x.xlsx'));
      expect(xlsx.read).toHaveBeenCalled();
      expect(contactService.create).toHaveBeenCalled();
    });

    it('should reject on read error', async () => {
      xlsx.read.and.throwError('err');
      await expectAsync(service.importXLSX(new File([''], 'x.xlsx')))
        .toBeRejectedWithError('err');
    });
  });

  describe('exportCSV', () => {
    it('should unparse and save a CSV blob', () => {
      papa.unparse.and.returnValue('a,b');
      service.exportCSV([{} as Contact]);
      expect(papa.unparse).toHaveBeenCalled();
      expect(fs.save).toHaveBeenCalledWith(
        jasmine.any(Blob), 'contacts.csv'
      );
    });
  });

  describe('exportXLSX', () => {
    it('should build workbook and save XLSX', () => {
      xlsx.jsonToSheet.and.returnValue({} as any);
      xlsx.bookNew.and.returnValue({Sheets: {}, SheetNames: []} as any);
      xlsx.write.and.returnValue(new Uint8Array([1, 2, 3]));
      service.exportXLSX([{} as Contact]);
      expect(xlsx.jsonToSheet).toHaveBeenCalled();
      expect(xlsx.bookNew).toHaveBeenCalled();
      expect(fs.save).toHaveBeenCalledWith(
        jasmine.any(Blob), 'contacts.xlsx'
      );
    });
  });

  describe('exportPDF', () => {
    it('should create PDF, autoTable and save', () => {
      const saveSpy = jasmine.createSpy('save');
      pdf.create.and.returnValue({save: saveSpy} as any);
      pdf.autoTable.and.callFake(() => {
      });

      service.exportPDF([{} as Contact]);
      expect(pdf.create).toHaveBeenCalled();
      expect(pdf.autoTable).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith('contacts.pdf');
    });
  });
});
