import {Injectable} from '@angular/core';
import {Functions, httpsCallable} from '@angular/fire/functions';
import {from, Observable} from 'rxjs';
import {map} from 'rxjs/operators';

export interface FirebaseUserInfo {
  uid: string;
  email: string;
}

@Injectable({providedIn: 'root'})
export class UsersService {
  constructor(private functions: Functions) {
  }

  /**
   * Zwraca Observable z danymi użytkownika ({ uid, email }),
   * korzystając z Callable Function getUserByEmail.
   */
  getUserByEmail(email: string): Observable<FirebaseUserInfo> {
    const fn = httpsCallable<{ email: string }, FirebaseUserInfo>(
      this.functions,
      'getUserByEmail'
    );
    // fn(...) zwraca Promise<HttpsCallableResult<FirebaseUserInfo>>
    // zamieniamy na Observable i mapujemy na .data
    return from(fn({email})).pipe(
      map(result => result.data)
    );
  }
}
