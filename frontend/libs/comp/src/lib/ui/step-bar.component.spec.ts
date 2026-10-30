/**
 * step-bar.component.spec.ts
 * FE-COMP-018: StepBarComponent state logic.
 */
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { StepBarComponent, StepDef } from './step-bar.component';

const COMP_STEPS: StepDef[] = [
  { key: 'importar',   label: 'Importar' },
  { key: 'configurar', label: 'Configurar' },
  { key: 'edicao',     label: 'Edição' },
  { key: 'exportar',   label: 'Exportar' },
];

@Component({
  standalone: true,
  imports: [StepBarComponent],
  template: `<comp-step-bar [steps]="steps" [current]="current" />`,
})
class HostComponent {
  steps = COMP_STEPS;
  current = 'configurar';
}

describe('StepBarComponent', () => {
  function setup(current: string) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.current = current;
    fixture.detectChanges();
    return fixture;
  }

  it('marks Configurar active and Importar done when current=configurar', () => {
    const fixture = setup('configurar');
    const comp = fixture.debugElement.query(
      el => el.componentInstance instanceof StepBarComponent,
    ).componentInstance as StepBarComponent;

    const steps = comp.stepsWithState();
    expect(steps[0].state).toBe('done');     // Importar
    expect(steps[1].state).toBe('active');   // Configurar
    expect(steps[2].state).toBe('pending');  // Edição
    expect(steps[3].state).toBe('pending');  // Exportar
  });

  it('marks Edição active, Importar and Configurar done when current=edicao', () => {
    const fixture = setup('edicao');
    const comp = fixture.debugElement.query(
      el => el.componentInstance instanceof StepBarComponent,
    ).componentInstance as StepBarComponent;

    const steps = comp.stepsWithState();
    expect(steps[0].state).toBe('done');     // Importar
    expect(steps[1].state).toBe('done');     // Configurar
    expect(steps[2].state).toBe('active');   // Edição
    expect(steps[3].state).toBe('pending');  // Exportar
  });

  it('renders a step marker with check icon for done steps', () => {
    const fixture = setup('edicao');
    const el: HTMLElement = fixture.nativeElement;
    const checkIcons = el.querySelectorAll('.material-symbols-outlined');
    // First 2 steps (Importar, Configurar) are done → have check icons
    expect(checkIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders all 4 step labels', () => {
    const fixture = setup('configurar');
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Importar');
    expect(text).toContain('Configurar');
    expect(text).toContain('Edição');
    expect(text).toContain('Exportar');
  });
});
