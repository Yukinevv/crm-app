import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {HttpClientModule} from '@angular/common/http';
import {routes} from './app.routes';
import {environment} from '../environments/environment';

import {connectFunctionsEmulator, getFunctions, provideFunctions} from '@angular/fire/functions';
import {getAuth, provideAuth} from '@angular/fire/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(HttpClientModule),

    // warstwa change‐detection
    provideZoneChangeDetection({eventCoalescing: true}),

    // routing
    provideRouter(routes),

    // inicjalizacja Firebase App
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Auth (opcjonalnie emulator)
    provideAuth(() => {
      const auth = getAuth();
      // if (!environment.production && environment.useEmulators) {
      //   connectAuthEmulator(
      //     auth,
      //     `http://${environment.emulator.auth.host}:${environment.emulator.auth.port}`,
      //     {disableWarnings: true}
      //   );
      // }
      return auth;
    }),

    // Functions (opcjonalnie emulator)
    provideFunctions(() => {
      const functions = getFunctions();
      if (!environment.production && environment.useEmulators) {
        connectFunctionsEmulator(
          functions,
          environment.emulator.functions.host,
          environment.emulator.functions.port
        );
      }
      return functions;
    }),
  ]
};
