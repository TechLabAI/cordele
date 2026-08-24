import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../shared/theme.service';

// Topbar Cordelê — limpa, editorial, sem busca global (não é dashboard)

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex h-14 flex-shrink-0 items-center gap-4 px-6"
            style="background:var(--bg-topbar);
                   border-bottom:2px solid oklch(58% 0.19 245 / 0.15);
                   backdrop-filter:blur(8px);">

      <!-- Breadcrumb / contexto -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <a routerLink="/biblioteca-de-projetos"
           class="text-sm font-medium transition-opacity hover:opacity-70"
           style="color:var(--text-secondary);">Projetos</a>
        <span class="material-symbols-outlined" style="color:var(--border-strong);font-size:14px;">chevron_right</span>
        <span class="text-sm font-bold truncate" style="color:oklch(42% 0.20 245);">Romance das Cidades</span>
      </div>

      <!-- Theme toggle -->
      <button (click)="theme.toggle()"
              class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
              style="color:var(--text-secondary);"
              [title]="theme.isDark() ? 'Tema claro' : 'Tema escuro'">
        <span class="material-symbols-outlined" style="font-size:18px;">
          {{ theme.isDark() ? 'light_mode' : 'dark_mode' }}
        </span>
      </button>

      <!-- Avatar -->
      <div class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
           style="background:oklch(58% 0.19 245 / 0.12);color:oklch(48% 0.19 245);">
        M
      </div>

    </header>
  `,
})
export class TopbarComponent {
  readonly theme = inject(ThemeService);
}
