import {Injectable} from '@angular/core';
import {saveAs} from 'file-saver';

@Injectable({providedIn: 'root'})
export class FileSaverWrapperService {
  save(blob: Blob, filename: string): void {
    saveAs(blob, filename);
  }
}
