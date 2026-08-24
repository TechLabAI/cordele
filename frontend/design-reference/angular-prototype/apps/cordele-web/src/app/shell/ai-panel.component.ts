import { Component, ChangeDetectionStrategy } from '@angular/core';

// IA Panel — sem IA no POC Cordelê (determinístico). Componente vazio para manter o import no shell.

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class AiPanelComponent {}
