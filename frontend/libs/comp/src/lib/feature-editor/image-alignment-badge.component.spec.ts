/**
 * image-alignment-badge.component.spec.ts
 * FE-COMP-017: ImageAlignmentBadgeComponent — 4 options, hidden when canEdit=false.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ImageAlignmentBadgeComponent } from './image-alignment-badge.component';
import { Alinhamento } from '../models/comp.models';

@Component({
  standalone: true,
  imports: [ImageAlignmentBadgeComponent],
  template: `
    <comp-image-alignment
      [alinhamento]="alinhamento()"
      [stale]="stale()"
      [canEdit]="canEdit()"
      (alignmentSelect)="onChange($event)"
    />
  `,
})
class HostComponent {
  alinhamento = signal<Alinhamento>('centralizado');
  stale       = signal(false);
  canEdit     = signal(true);
  lastChange: Alinhamento | null = null;
  onChange(v: Alinhamento): void { this.lastChange = v; }
}

describe('ImageAlignmentBadgeComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders 4 alignment buttons when canEdit=true', () => {
    const fixture = setup();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(4);
  });

  it('renders nothing when canEdit=false', () => {
    const fixture = setup();
    fixture.componentInstance.canEdit.set(false);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('shows stale warning when stale=true', () => {
    const fixture = setup();
    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('desatualizado');
  });

  it('does NOT show stale warning when stale=false', () => {
    const fixture = setup();
    fixture.componentInstance.stale.set(false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('desatualizado');
  });

  it('emits change when a different alignment is selected', () => {
    const fixture = setup();
    fixture.componentInstance.alinhamento.set('centralizado');
    fixture.detectChanges();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    // Click "Página inteira" (first option)
    buttons[0].click();
    expect(fixture.componentInstance.lastChange).toBe('full');
  });

  it('does NOT emit change when the same alignment is re-selected', () => {
    const fixture = setup();
    fixture.componentInstance.alinhamento.set('full');
    fixture.detectChanges();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click(); // 'full' again
    expect(fixture.componentInstance.lastChange).toBeNull();
  });
});
