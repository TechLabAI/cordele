/**
 * advance-bar.component.spec.ts
 * FE-COMP-012: AdvanceBarComponent — button state and emit.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AdvanceBarComponent } from './advance-bar.component';

@Component({
  standalone: true,
  imports: [AdvanceBarComponent],
  template: `
    <comp-advance-bar
      [canAdvance]="canAdvance()"
      [saving]="saving()"
      (advance)="onAdvance()"
    />
  `,
})
class HostComponent {
  canAdvance = signal(false);
  saving     = signal(false);
  advanced   = 0;
  onAdvance(): void { this.advanced++; }
}

describe('AdvanceBarComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('button is disabled when canAdvance=false', () => {
    const fixture = setup();
    fixture.componentInstance.canAdvance.set(false);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('button is enabled when canAdvance=true and saving=false', () => {
    const fixture = setup();
    fixture.componentInstance.canAdvance.set(true);
    fixture.componentInstance.saving.set(false);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(false);
  });

  it('button is disabled when saving=true regardless of canAdvance', () => {
    const fixture = setup();
    fixture.componentInstance.canAdvance.set(true);
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('emits advance when button clicked and canAdvance=true', () => {
    const fixture = setup();
    fixture.componentInstance.canAdvance.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(fixture.componentInstance.advanced).toBe(1);
  });

  it('does NOT emit advance when canAdvance=false', () => {
    const fixture = setup();
    fixture.componentInstance.canAdvance.set(false);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(fixture.componentInstance.advanced).toBe(0);
  });

  it('shows "Salvando..." text when saving=true', () => {
    const fixture = setup();
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Salvando...');
  });
});
