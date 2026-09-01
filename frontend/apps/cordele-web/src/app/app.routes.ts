import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: 'imp',
        // FE-IMP-003: load from canonical shell-entry path (P3)
        loadChildren: () =>
          import('@cordele/imp/shell-entry').then(m => m.IMP_ROUTES),
      },
      {
        path: 'comp',
        loadChildren: () =>
          import('@cordele/comp').then(r => r.COMP_ROUTES),
      },
      {
        path: 'pub',
        // FE-PUB-002: load from canonical shell-entry (P1 Foundation)
        loadChildren: () =>
          import('@cordele/pub-shell-entry').then(r => r.PUB_ROUTES),
      },
      {
        path: 'proj',
        loadChildren: () =>
          import('@cordele/proj').then(r => r.PROJ_ROUTES),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
