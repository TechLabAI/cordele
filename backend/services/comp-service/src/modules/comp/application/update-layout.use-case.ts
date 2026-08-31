import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride, type OverrideTipo, type Alinhamento } from '../../../domain/comp/layout-override.entity';
import type { ConfiguracaoLayoutRepositoryPort } from '../ports/configuracao-layout-repository.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';
import { type ManuscriptContentPort, collectNodeIds } from '../ports/manuscript-content.port';
import { COMP_LAYOUT_REPO, COMP_MANUSCRIPT_CONTENT_PORT, COMP_EVENT_EMITTER } from '../comp.tokens';

/**
 * Typography and layout fields accepted by the PUT layout endpoint (api-contract §4.6).
 * Maps directly to the flat fields of the ConfiguracaoLayout aggregate.
 */
export interface LayoutTipografiaInput {
  readonly fonte_corpo_familia?: 'serif' | 'sans-serif';
  readonly fonte_corpo_tamanho?: number;
  readonly espacamento_linha?: number;
  readonly margem_lateral?: number;
  readonly h1_tamanho?: number;
  readonly h2_tamanho?: number;
  readonly h3_tamanho?: number;
}

export interface OverrideInput {
  readonly referenciaNo: string;
  readonly tipo: OverrideTipo;
  readonly alinhamento?: Alinhamento | null;
  readonly ordem: number;
}

export interface UpdateLayoutInput {
  readonly projetoId: string;
  readonly tipografia: LayoutTipografiaInput;
  readonly overrides?: OverrideInput[];
}

/**
 * Idempotent upsert of layout configuration (T06, api-contract §4.6).
 *
 * Rules:
 *   - tipo='em-branco' overrides are rejected by LayoutOverride constructor (422, D-H).
 *   - Each override's referenciaNo is validated against ManuscriptContentPort.getContentTree.
 *     Overrides whose referenciaNo is absent are marked stale (D-K).
 *   - When ManuscriptContentPort returns null (no manuscript yet) ALL overrides
 *     are marked stale (defensive: cannot validate referenciaNo without the tree).
 *   - Only active (non-stale) overrides are counted by PUB; the repository persists
 *     all overrides (stale included) for editor awareness.
 *
 * Concurrency: DB UNIQUE(projeto_id) serializes concurrent writes —
 * no optimistic lock needed (per-project singleton).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class UpdateLayoutUseCase {
  private readonly logger = new Logger(UpdateLayoutUseCase.name);

  constructor(
    @Inject(COMP_LAYOUT_REPO)
    private readonly layoutRepo: ConfiguracaoLayoutRepositoryPort,
    @Inject(COMP_MANUSCRIPT_CONTENT_PORT)
    private readonly manuscriptContent: ManuscriptContentPort,
    @Inject(COMP_EVENT_EMITTER)
    private readonly eventEmitter: DomainEventEmitter,
  ) {}

  async execute(input: UpdateLayoutInput): Promise<ConfiguracaoLayout> {
    this.logger.debug(`UpdateLayout projetoId=${input.projetoId}`);

    // Build LayoutOverride entities — constructor rejects tipo='em-branco' (D-H, 422).
    const rawOverrides: LayoutOverride[] = (input.overrides ?? []).map(
      (o) =>
        new LayoutOverride({
          referenciaNo: o.referenciaNo,
          tipo: o.tipo,
          alinhamento: o.alinhamento,
          ordem: o.ordem,
        }),
    );

    // Validate override referenciaNo against the manuscript content tree (D-K).
    let existingNodeIds = new Set<string>();
    if (rawOverrides.length > 0) {
      const tree = await this.manuscriptContent.getContentTree(input.projetoId);
      // When tree is null (no manuscript yet), all overrides become stale.
      existingNodeIds = tree ? collectNodeIds(tree.estrutura) : new Set<string>();
    }

    const validatedOverrides = rawOverrides.map((o) =>
      existingNodeIds.has(o.referenciaNo) ? o : o.markStale(),
    );

    const existing = await this.layoutRepo.findByProjetoId(input.projetoId);

    // Idempotency (COMP-007, SPEC-05): if the persisted state is already identical
    // to the incoming payload (typography + override set, ignoring runtime stale
    // flags), skip the upsert and the LayoutUpdated event entirely (no-op).
    // The no-op path still re-applies stale flags so the response is accurate.
    if (existing !== null && existing.equalsInput(input.tipografia, validatedOverrides)) {
      this.logger.debug(`UpdateLayout no-op (identical payload) projetoId=${input.projetoId}`);
      return this.applyStaleFlags(existing, validatedOverrides);
    }

    const base = existing ?? ConfiguracaoLayout.createDefault(input.projetoId);

    // RULE-03: the application service is the only place that coordinates
    // multi-step persistence. The aggregate.update() enforces all invariants
    // before we hand off to the repository.
    const updated = base.update(input.tipografia, validatedOverrides);

    const persisted = await this.layoutRepo.upsert(updated);

    // Emit LayoutUpdated after a real (mutating) upsert (COMP-007).
    this.eventEmitter.emit('LayoutUpdated', {
      projetoId: input.projetoId,
      ...(persisted.empresaSlug ? { empresaSlug: persisted.empresaSlug } : {}),
    });

    // The `stale` flag is a runtime concept computed above against the content tree.
    // It is NOT stored in the DB (no stale column in layout_override) — the mapper
    // always returns stale=false when reading back from DB. Re-apply the computed
    // stale flags here so the response reflects the actual validation result (D-K).
    return this.applyStaleFlags(persisted, validatedOverrides);
  }

  /**
   * Returns a copy of `layout` with the stale flags from `validatedOverrides`
   * re-applied. Used after both real upserts and no-op idempotency paths so
   * the caller always receives the correct runtime stale state (D-K).
   */
  private applyStaleFlags(
    layout: ConfiguracaoLayout,
    validatedOverrides: LayoutOverride[],
  ): ConfiguracaoLayout {
    const staleRefs = new Set(
      validatedOverrides.filter((o) => o.stale).map((o) => o.referenciaNo),
    );
    if (staleRefs.size === 0) {
      return layout;
    }
    const overridesWithStale = (layout.overrides as LayoutOverride[]).map((o) =>
      staleRefs.has(o.referenciaNo) ? o.markStale() : o,
    );
    return new ConfiguracaoLayout({
      id: layout.id || undefined,
      projetoId: layout.projetoId,
      fonte_corpo_familia: layout.fonte_corpo_familia,
      fonte_corpo_tamanho: layout.fonte_corpo_tamanho,
      espacamento_linha: layout.espacamento_linha,
      margem_lateral: layout.margem_lateral,
      h1_tamanho: layout.h1_tamanho,
      h2_tamanho: layout.h2_tamanho,
      h3_tamanho: layout.h3_tamanho,
      overrides: overridesWithStale,
      materialized: layout.materialized,
      ...(layout.empresaSlug ? { empresaSlug: layout.empresaSlug } : {}),
      atualizadoEm: layout.atualizadoEm,
    });
  }
}
