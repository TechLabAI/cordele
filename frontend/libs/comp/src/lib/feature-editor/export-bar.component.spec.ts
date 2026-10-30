/**
 * export-bar.component.spec.ts
 * FE-COMP-017: ExportBarComponent — button state and emit.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ExportBarComponent } from './export-bar.component';

@Component({
  standalone: true,
  imports: [ExportBarComponent],
  template: `
    <comp-export-bar
      [saving]="saving()"
      [canExport]="canExport()"
      (exportClicked)="onExport()"
    />
  `,
})
class HostComponent {
  saving    = signal(false);
  canExport = signal(false);
  exported  = 0;
  onExport(): void { this.exported++; }
}

describe('ExportBarComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('button is disabled when canExport=false', () => {
    const fixture = setup();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('button is enabled when canExport=true and saving=false', () => {
    const fixture = setup();
    fixture.componentInstance.canExport.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(false);
  });

  it('button is disabled when saving=true even if canExport=true', () => {
    const fixture = setup();
    fixture.componentInstance.canExport.set(true);
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('emits export when button clicked and canExport=true', () => {
    const fixture = setup();
    fixture.componentInstance.canExport.set(true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.exported).toBe(1);
  });

  it('does NOT emit export when canExport=false', () => {
    const fixture = setup();
    fixture.componentInstance.canExport.set(false);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.exported).toBe(0);
  });

  it('shows "Exportando..." text when saving=true', () => {
    const fixture = setup();
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Exportando...');
  });
});
