/**
 * page-paginator.component.spec.ts
 * FE-COMP-016: PagePaginatorComponent — boundary states.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { PagePaginatorComponent } from './page-paginator.component';

@Component({
  standalone: true,
  imports: [PagePaginatorComponent],
  template: `
    <comp-page-paginator
      [index]="index()"
      [total]="total()"
      (prev)="onPrev()"
      (next)="onNext()"
    />
  `,
})
class HostComponent {
  index   = signal(0);
  total   = signal(5);
  prevs   = 0;
  nexts   = 0;
  onPrev(): void { this.prevs++; }
  onNext(): void { this.nexts++; }
}

describe('PagePaginatorComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('Prev button is disabled at index=0', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(0);
    fixture.detectChanges();
    const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    expect(btns[0].disabled).toBe(true); // Prev
    expect(btns[1].disabled).toBe(false); // Next
  });

  it('Next button is disabled at index=total-1', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(4);
    fixture.componentInstance.total.set(5);
    fixture.detectChanges();
    const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    expect(btns[0].disabled).toBe(false); // Prev
    expect(btns[1].disabled).toBe(true);  // Next
  });

  it('emits prev when Prev button is clicked in a middle page', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(2);
    fixture.detectChanges();
    const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    btns[0].click();
    expect(fixture.componentInstance.prevs).toBe(1);
  });

  it('emits next when Next button is clicked in a middle page', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(2);
    fixture.detectChanges();
    const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    btns[1].click();
    expect(fixture.componentInstance.nexts).toBe(1);
  });

  it('does NOT emit prev when at index=0', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(0);
    fixture.detectChanges();
    const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    btns[0].click();
    expect(fixture.componentInstance.prevs).toBe(0);
  });

  it('shows "Página X de Y" text', () => {
    const fixture = setup();
    fixture.componentInstance.index.set(2);
    fixture.componentInstance.total.set(7);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('3 de 7');
  });
});
