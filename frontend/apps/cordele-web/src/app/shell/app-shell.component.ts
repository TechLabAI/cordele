import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell-layout">
      <app-sidebar class="shell-sidebar" />
      <div class="shell-main">
        <app-topbar class="shell-topbar" />
        <main class="shell-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell-layout {
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: 1fr;
      height: 100vh;
      overflow: hidden;
    }
    .shell-main {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .shell-content {
      flex: 1;
      overflow: auto;
    }
  `],
})
export class AppShellComponent {}
