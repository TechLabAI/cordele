/**
 * app.config.ts — root ApplicationConfig for cordele-web.
 * P2 shell setup (first module promoted — IMP, D-494).
 * - No withHashLocation() (P2.4: removed, deep-linkable routes).
 * - provideHttpClient: required by all HTTP adapters.
 * - Module providers: default mock adapters (flip to 'http' when services are up).
 */
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { provideImp } from '@cordele/imp';
import { provideComp } from '@cordele/comp';
import { provideProj } from '@cordele/proj';
import { providePub } from '@cordele/pub';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    provideImp({ adapter: 'mock' }),
    provideComp({ adapter: 'mock' }),
    provideProj({ adapter: 'mock' }),
    providePub({ adapter: 'mock' }),
  ],
};
