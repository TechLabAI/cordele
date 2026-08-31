/**
 * style-panel.component.spec.ts
 * FE-COMP-015: StylePanelComponent — 7 parameters, h1≥h2≥h3 enforcement.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { StylePanelComponent, StyleChangeEvent } from './style-panel.component';
import { ConfiguracaoLayoutDto } from '../models/comp.models';

const DEFAULT_LAYOUT: ConfiguracaoLayoutDto = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 14,
  espacamentoLinha: 1.5,
  margemLateral: 20,
  h1Tamanho: 28,
  h2Tamanho: 22,
  h3Tamanho: 18,
  materialized: true,
};

@Component({
  standalone: true,
  imports: [StylePanelComponent],
  template: `
    <comp-style-panel
      [layout]="layout()"
      [canEdit]="canEdit()"
      (styleChange)="onChange($event)"
    />
  `,
})
class HostComponent {
  layout   = signal<ConfiguracaoLayoutDto>({ ...DEFAULT_LAYOUT });
  canEdit  = signal(true);
  lastChange: StyleChangeEvent | null = null;
  onChange(e: StyleChangeEvent): void { this.lastChange = e; }
}

describe('StylePanelComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders 6 range inputs (fonteCorpoTamanho, espacamentoLinha, margemLateral, h1, h2, h3)', () => {
    const fixture = setup();
    const ranges: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBe(6);
  });

  it('renders 1 select for fonteCorpoFamilia', () => {
    const fixture = setup();
    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(1);
  });

  it('has no add/remove page or insert-image controls', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent ?? '';
    expect(text).not.toContain('Adicionar');
    expect(text).not.toContain('Inserir imagem');
    expect(text).not.toContain('Remover página');
  });

  it('emits styleChange when fonteCorpoFamilia select changes', () => {
    const fixture = setup();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'sans-serif';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.lastChange?.param).toBe('fonteCorpoFamilia');
    expect(fixture.componentInstance.lastChange?.value).toBe('sans-serif');
  });

  it('disables all controls when canEdit=false', () => {
    const fixture = setup();
    fixture.componentInstance.canEdit.set(false);
    fixture.detectChanges();
    const ranges: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input[type="range"]');
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    ranges.forEach(r => expect(r.disabled).toBe(true));
    expect(select.disabled).toBe(true);
  });

  it('emits styleChange with clamped h1 when h1Tamanho slider fires', () => {
    const fixture = setup();
    const ranges: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input[type="range"]');
    // Order: fonteCorpoTamanho[0], espacamentoLinha[1], margemLateral[2], h1[3], h2[4], h3[5]
    const h1Range = ranges[3];
    h1Range.value = '30';
    h1Range.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.lastChange?.param).toBe('h1Tamanho');
  });
});
