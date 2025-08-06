import {Injectable} from '@angular/core';
import * as Papa from 'papaparse';

@Injectable({providedIn: 'root'})
export class PapaWrapperService {
  parse<T>(file: File, config: Papa.ParseLocalConfig<T, File>): void {
    Papa.parse<T, File>(file, config);
  }

  unparse(data: any): string {
    return Papa.unparse(data);
  }
}
