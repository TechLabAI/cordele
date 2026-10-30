/**
 * content-block.component.ts — Presentational (FE-IMP-017).
 * Renders a single unparsed block row with reason label, source ref, ignore button.
 * The ignored state is passed via the parent (signal-derived in RevisaoDeEstruturaComponent).
 *
 * Input:  block   — UnparsedBlock from the content tree
 *         ignored — true if this block id is in the ignore set
 * Output: ignore(fragmentId: string) — emitted when user clicks "Ignorar"
 *         restore(fragmentId: string) — emitted when user clicks "Restaurar"
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { UnparsedBlock, UnparsedReason, UNPARSED_REASON_LABEL } from '@cordele/imp/data-access';

function sourceRef(blk: UnparsedBlock): string {
  const loc = blk.sourceLocation;
  if (loc.kind === 'docx')     return `par. ${loc.paragraphIndex}`;
  if (loc.kind === 'markdown') return `linha ${loc.line}`;
  return '?';
}

function reasonLabel(reason: UnparsedReason): string {
  return UNPARSED_REASON_LABEL[reason] ?? reason;
}

@Component({
  selector: 'imp-content-block',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (block) {
      <div
        class="px-4 py-3 text-sm"
        style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);"
        [style.opacity]="ignored ? '0.45' : '1'"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-medium" style="color:var(--color-warning-ink)">
              {{ label() }}
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text-secondary)">
              Pág. ~{{ ref() }}
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">
              Segmento {{ block.id }}
            </p>
          </div>
          @if (!ignored) {
            <button
              (click)="ignore.emit(block.id)"
              class="text-xs underline shrink-0"
              style="color:var(--text-tertiary)"
            >
              Ignorar
            </button>
          } @else {
            <button
              (click)="restore.emit(block.id)"
              class="text-xs underline shrink-0"
              style="color:var(--text-tertiary)"
            >
              Restaurar
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class ContentBlockComponent {
  @Input() block!: UnparsedBlock;
  /** True when this block's id is in the ReviewFacade ignored set. */
  @Input() ignored = false;

  /** Emitted when the user clicks "Ignorar". Carries the fragment id. */
  @Output() ignore  = new EventEmitter<string>();
  /** Emitted when the user clicks "Restaurar". Carries the fragment id. */
  @Output() restore = new EventEmitter<string>();

  protected label = () => reasonLabel(this.block.reason);
  protected ref   = () => sourceRef(this.block);
}
