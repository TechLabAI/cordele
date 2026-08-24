import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <span class="topbar-title">Cordelê</span>
      <select class="topbar-tenant" [ngModel]="activeEmpresa()" (ngModelChange)="activeEmpresa.set($event)">
        <!-- Populated at runtime from the auth/tenant service -->
      </select>
      <div class="topbar-actions">
        <!-- search, notifications, user menu -->
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .topbar-title { font-weight: 600; }
    .topbar-actions { margin-left: auto; display: flex; gap: 0.5rem; }
  `],
})
export class TopbarComponent {
  readonly activeEmpresa = signal<string>('');
}
