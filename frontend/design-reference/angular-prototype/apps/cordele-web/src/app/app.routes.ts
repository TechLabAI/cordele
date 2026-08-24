import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

export const APP_ROUTES: Routes = [
  {
    path: 'entrada',
    loadComponent: () =>
      import('./screens/entrada/entrada.component').then(m => m.EntradaComponent),
    data: { label: 'Entrada', icon: '•' },
  },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'biblioteca-de-projetos', pathMatch: 'full' }, // shell default
      {
        path: 'biblioteca-de-projetos',
        loadComponent: () =>
          import('./screens/biblioteca-de-projetos/biblioteca-de-projetos.component').then(m => m.BibliotecaDeProjetosComponent),
        data: { label: 'Biblioteca De Projetos', icon: '•' },
      },
      {
        path: 'upload',
        loadComponent: () =>
          import('./screens/upload/upload.component').then(m => m.UploadComponent),
        data: { label: 'Upload', icon: '📤' },
      },
      {
        path: 'revisao-de-estrutura',
        loadComponent: () =>
          import('./screens/revisao-de-estrutura/revisao-de-estrutura.component').then(m => m.RevisaoDeEstruturaComponent),
        data: { label: 'Revisao De Estrutura', icon: '•' },
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./screens/configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent),
        data: { label: 'Configurações', icon: '⚙️' },
      },
      {
        path: 'editor-de-layout-preview',
        loadComponent: () =>
          import('./screens/editor-de-layout-preview/editor-de-layout-preview.component').then(m => m.EditorDeLayoutPreviewComponent),
        data: { label: 'Editor De Layout Preview', icon: '•' },
      },
      {
        path: 'exportacao-e-validacao',
        loadComponent: () =>
          import('./screens/exportacao-e-validacao/exportacao-e-validacao.component').then(m => m.ExportacaoEValidacaoComponent),
        data: { label: 'Exportacao E Validacao', icon: '•' },
      },
      {
        path: 'download-e-historico',
        loadComponent: () =>
          import('./screens/download-e-historico/download-e-historico.component').then(m => m.DownloadEHistoricoComponent),
        data: { label: 'Download E Historico', icon: '•' },
      },
    ],
  },
  { path: '', redirectTo: 'entrada', pathMatch: 'full' },
  { path: '**', redirectTo: 'entrada' },
];
