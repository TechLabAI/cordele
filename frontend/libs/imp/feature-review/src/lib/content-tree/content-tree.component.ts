/**
 * content-tree.component.ts — Presentational (FE-IMP-017).
 * Renders the full list of unparsed blocks extracted from the ContentTree.
 * Computes the flat list from the tree internally (chapters → sections → blocks).
 * Ignores/restore events bubble up via the `ignore(fragmentId)` output to the
 * smart RevisaoDeEstruturaComponent.
 *
 * Input:  tree      — ContentTree | null (null renders nothing)
 *         ignoredIds — Set<string> of segment ids currently marked as ignored
 * Output: ignore(fragmentId: string) — relay from ContentBlockComponent
 *         restore(fragmentId: string) — relay from ContentBlockComponent
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';
import {
  ContentTree,
  UnparsedBlock,
  Block,
} from '@cordele/imp/data-access';
import { ContentBlockComponent } from '../content-block/content-block.component';

function extractUnparsed(tree: ContentTree | null): UnparsedBlock[] {
  if (!tree) return [];
  const result: UnparsedBlock[] = [];
  for (const ch of tree.chapters) {
    for (const b of ch.blocks) {
      if (b.type === 'unparsed') result.push(b as UnparsedBlock);
    }
    for (const sec of ch.sections) {
      for (const b of sec.blocks) {
        if ((b as Block).type === 'unparsed') result.push(b as UnparsedBlock);
      }
    }
  }
  return result;
}

@Component({
  selector: 'imp-content-tree',
  standalone: true,
  imports: [ContentBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
      <div class="px-4 py-2.5" style="background:var(--bg-surface-active);">
        <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--text-tertiary)">Pendências</span>
      </div>

      @if (blocks().length === 0) {
        <div class="px-4 py-8 text-center text-sm"
             style="color:var(--text-tertiary);background:var(--bg-surface);">
          Nenhuma pendência detectada
        </div>
      }

      @for (blk of blocks(); track blk.id) {
        <imp-content-block
          [block]="blk"
          [ignored]="ignoredIds.has(blk.id)"
          (ignore)="ignore.emit($event)"
          (restore)="restore.emit($event)"
        />
      }
    </div>
  `,
})
export class ContentTreeComponent implements OnChanges {
  @Input() tree: ContentTree | null = null;
  /** Current set of ignored segment ids — passed from smart component. */
  @Input() ignoredIds: Set<string> = new Set();

  /** Relay from ContentBlockComponent — emits the fragment id to ignore. */
  @Output() ignore  = new EventEmitter<string>();
  /** Relay from ContentBlockComponent — emits the fragment id to restore. */
  @Output() restore = new EventEmitter<string>();

  protected readonly blocks = signal<UnparsedBlock[]>([]);

  ngOnChanges(): void {
    this.blocks.set(extractUnparsed(this.tree));
  }
}
