/**
 * idioma-select.component.spec.ts
 * FE-COMP-012: IdiomaSelectComponent — lists exactly pt/en/es/fr, emits change.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { IdiomaSelectComponent } from './idioma-select.component';
import { MetadadosIdioma } from '../models/comp.models';

@Component({
  standalone: true,
  imports: [IdiomaSelectComponent],
  template: `
    <comp-idioma-select [value]="value()" (idiomaChange)="onChange($event)" />
  `,
})
class HostComponent {
  value   = signal<MetadadosIdioma>('pt');
  changed: MetadadosIdioma | null = null;
  onChange(v: MetadadosIdioma): void { this.changed = v; }
}

describe('IdiomaSelectComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists exactly 4 idioma options (pt, en, es, fr)', () => {
    const fixture = setup();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['pt', 'en', 'es', 'fr']);
  });

  it('reflects the current value in the select', () => {
    const fixture = setup();
    fixture.componentInstance.value.set('en');
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.value).toBe('en');
  });

  it('emits change when the user selects a different idioma', () => {
    const fixture = setup();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'fr';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.changed).toBe('fr');
  });
});
