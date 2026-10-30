/**
 * breadcrumb-dynamic.component.ts — Dynamic breadcrumb for IMP routes (FE-IMP-020).
 *
 * Presentational component that renders a breadcrumb trail from an array of
 * {label, route} tuples. Each item (except the last) is a link; the last is
 * shown as plain text (current page).
 *
 * Inputs:
 *   crumbs — ordered array of { label: string; route: string }
 *
 * Rules:
 *   - standalone: true
 *   - OnPush
 *   - Pure presentational (no HTTP or service injection)
 *
 * Usage (from a parent component or route data resolver):
 *   <imp-breadcrumb-dynamic
 *     [crumbs]="[{ label: 'Projetos', route: '/proj' }, { label: 'Importar', route: '/imp/upload' }]"
 *   />
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  route: string;
}

@Component({
  selector: 'imp-breadcrumb-dynamic',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (crumbs.length) {
      <nav aria-label="Migalhas de pão">
        <ol class="flex items-center gap-1 text-sm flex-wrap">
          @for (crumb of crumbs; track $index) {
            <li class="flex items-center gap-1">
              @if (!$last) {
                <a
                  [routerLink]="crumb.route"
                  style="color:var(--color-brand)"
                  class="hover:underline">
                  {{ crumb.label }}
                </a>
                <span style="color:var(--text-tertiary)" aria-hidden="true">›</span>
              } @else {
                <span
                  style="color:var(--text-secondary);font-weight:500"
                  [attr.aria-current]="'page'">
                  {{ crumb.label }}
                </span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
})
export class BreadcrumbDynamicComponent {
  /** Breadcrumb trail in display order. Last item = current page (no link). */
  @Input() crumbs: BreadcrumbItem[] = [];
}
