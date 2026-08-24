/**
 * app.config.ts — root ApplicationConfig for cordele-web.
 * P2 shell setup (first module promoted — IMP, D-494).
 * - No withHashLocation() (P2.4: removed, deep-linkable routes).
 * - provideHttpClient: required by all HTTP adapters.
 * - provideImp: default mock adapter (flip to 'http' when imp-service is up).
 */
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { provideImp } from '@cordele/imp';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    provideImp({ adapter: 'mock' }),
  ],
};
