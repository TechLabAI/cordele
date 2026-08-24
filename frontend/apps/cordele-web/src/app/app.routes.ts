import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: 'imp',
        loadChildren: () =>
          import('@cordele/imp').then(r => r.IMP_ROUTES),
      },
      {
        path: 'comp',
        loadChildren: () =>
          import('@cordele/comp').then(r => r.COMP_ROUTES),
      },
      {
        path: 'pub',
        loadChildren: () =>
          import('@cordele/pub').then(r => r.PUB_ROUTES),
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
