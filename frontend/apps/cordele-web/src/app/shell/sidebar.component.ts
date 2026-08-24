import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, filter, map } from 'rxjs';

interface NavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/imp', label: 'Importação' },
  { path: '/comp', label: 'Composição' },
  { path: '/pub', label: 'Publicação' },
  { path: '/proj', label: 'Projetos' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="sidebar">
      <div class="sidebar-brand">Cordelê</div>
      <ul class="sidebar-nav">
        @for (item of navItems; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              class="sidebar-link"
            >{{ item.label }}</a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [`
    .sidebar { display: flex; flex-direction: column; width: 240px; height: 100%; }
    .sidebar-brand { padding: 1rem; font-weight: 600; }
    .sidebar-nav { list-style: none; margin: 0; padding: 0; }
    .sidebar-link { display: block; padding: 0.5rem 1rem; text-decoration: none; }
    .sidebar-link.active { font-weight: 600; }
  `],
})
export class SidebarComponent {
  readonly navItems = NAV_ITEMS;
}
