import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  constructor() {
    effect(() => {
      const html = document.documentElement;
      if (this.isDark()) {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }
}
