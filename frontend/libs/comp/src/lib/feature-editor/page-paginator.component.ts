/**
 * page-paginator.component.ts — prev/next page controls for T06 preview.
 * FE-COMP-016 / SPEC-02 §2.
 *
 * Presentational:
 *   - Prev disabled at index=0; Next disabled at index=total-1.
 *   - Emits prev() / next() — NO network calls; state managed by LayoutFacade.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'comp-page-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center gap-4 py-3 border-t text-sm flex-shrink-0"
         style="background:var(--bg-surface);border-color:var(--border-subtle);">

      <button
        type="button"
        (click)="onPrev()"
        [disabled]="isFirst()"
        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
        [style]="isFirst() ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'"
        aria-label="Página anterior"
      >
        <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">chevron_left</span>
        Anterior
      </button>

      <span style="color:var(--text-secondary)" aria-live="polite" aria-atomic="true">
        Página {{ index() + 1 }} de {{ total() }}
        <span class="ml-1 text-xs" style="color:var(--text-tertiary)">(prévia)</span>
      </span>

      <button
        type="button"
        (click)="onNext()"
        [disabled]="isLast()"
        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
        [style]="isLast() ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'"
        aria-label="Próxima página"
      >
        Próxima
        <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">chevron_right</span>
      </button>

    </div>
  `,
})
export class PagePaginatorComponent {
  readonly index = input.required<number>();
  readonly total = input.required<number>();

  /** Emits when the user clicks the Previous button. */
  readonly prev = output<void>();
  /** Emits when the user clicks the Next button. */
  readonly next = output<void>();

  readonly isFirst = computed(() => this.index() <= 0);
  readonly isLast  = computed(() => this.index() >= this.total() - 1);

  onPrev(): void {
    if (!this.isFirst()) this.prev.emit();
  }

  onNext(): void {
    if (!this.isLast()) this.next.emit();
  }
}
