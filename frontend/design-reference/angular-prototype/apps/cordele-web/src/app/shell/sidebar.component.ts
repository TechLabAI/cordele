import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../shared/theme.service';

interface NavItem { id: string; label: string; icon: string; route: string; divider?: boolean; }

const NAV: NavItem[] = [
  { id: 'biblioteca-de-projetos', label: 'Projetos',      icon: 'library_books', route: '/biblioteca-de-projetos' },
  { id: 'upload',                 label: 'Novo projeto',  icon: 'upload_file',   route: '/upload', divider: true },
  { id: 'revisao-de-estrutura',   label: 'Revisão',       icon: 'fact_check',    route: '/revisao-de-estrutura' },
  { id: 'configuracoes',          label: 'Metadados',     icon: 'tune',          route: '/config' },
  { id: 'editor-de-layout',       label: 'Edição',        icon: 'edit_document', route: '/editor-de-layout-preview' },
  { id: 'exportacao',             label: 'Exportação',    icon: 'file_export',   route: '/exportacao-e-validacao' },
  { id: 'historico',              label: 'Histórico',     icon: 'history',       route: '/download-e-historico' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="flex h-full flex-col"
           style="width:var(--sidebar-width);
                  background:var(--bg-sidebar);
                  border-right:1px solid oklch(36% 0.18 245);">

      <!-- Acento gradiente no topo -->
      <div style="height:4px;background:linear-gradient(90deg,oklch(58% 0.19 245),oklch(48% 0.22 220));flex-shrink:0;"></div>

      <!-- Logo — link para home -->
      <a routerLink="/entrada"
         class="flex h-20 items-center justify-center px-5 transition-opacity hover:opacity-80"
         style="border-bottom:1px solid oklch(36% 0.18 245);">
        <img class="h-14 w-auto" src="assets/logo_white.png" alt="Cordelê" />
      </a>

      <!-- Navegação -->
      <nav class="flex-1 overflow-y-auto px-3 py-4">
        @for (item of nav; track item.id) {
          @if (item.divider) {
            <div class="my-3 mx-2" style="border-top:1px solid oklch(36% 0.18 48 / 0.60);"></div>
          }
          <a [routerLink]="item.route"
             routerLinkActive #rla="routerLinkActive"
             class="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
             [style]="rla.isActive
               ? 'background:oklch(100% 0 0 / 0.18);color:white;border-left:3px solid white;padding-left:9px;'
               : 'color:oklch(100% 0 0 / 0.72);border-left:3px solid transparent;padding-left:9px;'"
             onmouseenter="if(!this.classList.contains('active'))this.style.background='oklch(100% 0 0 / 0.10)'"
             onmouseleave="if(!this.classList.contains('active'))this.style.background='transparent'">
            <span class="material-symbols-outlined shrink-0"
                  style="font-size:18px;"
                  [style.color]="rla.isActive ? 'white' : 'oklch(100% 0 0 / 0.80)'">
              {{ item.icon }}
            </span>
            <span class="flex-1">{{ item.label }}</span>
          </a>
        }
      </nav>

      <!-- Rodapé: theme toggle + usuário -->
      <div class="flex flex-col" style="border-top:1px solid oklch(36% 0.18 245);">

        <!-- Theme toggle -->
        <button (click)="theme.toggle()"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-opacity hover:opacity-80"
                style="color:oklch(100% 0 0 / 0.60);">
          <span class="material-symbols-outlined" style="font-size:16px;color:oklch(100% 0 0 / 0.60);">
            {{ theme.isDark() ? 'light_mode' : 'dark_mode' }}
          </span>
          <span>{{ theme.isDark() ? 'Tema claro' : 'Tema escuro' }}</span>
        </button>

        <!-- Usuário -->
        <div class="flex items-center gap-3 px-4 py-3"
             style="border-top:1px solid oklch(36% 0.18 48 / 0.60);">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
               style="background:oklch(100% 0 0 / 0.22);color:white;">
            M
          </div>
          <div class="min-w-0 leading-tight">
            <div class="truncate text-xs font-semibold" style="color:white;">Marina</div>
            <div class="truncate text-[11px]" style="color:oklch(100% 0 0 / 0.60);">Editora Aetós</div>
          </div>
        </div>
      </div>

    </aside>
  `,
})
export class SidebarComponent {
  readonly nav = NAV;
  readonly theme = inject(ThemeService);
}
