import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { AiPanelComponent } from './ai-panel.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, AiPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell-layout">
      <app-sidebar />
      <div class="shell-main">
        <app-topbar />
        <main class="shell-content"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: [`:host { display: contents; }
    .shell-layout { display: grid; grid-template-columns: auto 1fr;
                    height: 100vh; overflow: hidden; }
    .shell-main { display: flex; flex-direction: column;
                  overflow: hidden; min-width: 0; }
    .shell-content { flex: 1; overflow: auto; background: var(--bg-base); }`],
})
export class ShellComponent {}
