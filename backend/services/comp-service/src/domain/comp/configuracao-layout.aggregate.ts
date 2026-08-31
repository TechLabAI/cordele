import { DomainException } from '../shared/domain-exception';
import { LayoutOverride } from './layout-override.entity';
import {
  FonteCorpo,
  EspacamentoLinha,
  MargemLateral,
  HeadingSize,
  validateHeadingOrder,
} from './value-objects/tipografia.vo';

/**
 * Canonical defaults for a new (non-materialized) ConfiguracaoLayout.
 * Values match data-model §2.2 DEFAULT column values.
 */
const DEFAULTS = {
  fonte_corpo_familia: 'serif' as const,
  fonte_corpo_tamanho: 12,
  espacamento_linha: 1.5,
  margem_lateral: 20,
  h1_tamanho: 28,
  h2_tamanho: 22,
  h3_tamanho: 18,
};

export interface ConfiguracaoLayoutProps {
  readonly id?: string;
  readonly projetoId: string;
  readonly fonte_corpo_familia: 'serif' | 'sans-serif';
  readonly fonte_corpo_tamanho: number;
  readonly espacamento_linha: number;
  readonly margem_lateral: number;
  readonly h1_tamanho: number;
  readonly h2_tamanho: number;
  readonly h3_tamanho: number;
  readonly overrides: LayoutOverride[];
  readonly materialized: boolean;
  /**
   * Optional tenant slug — required for multi-empresa persistence routing but
   * not enforced by the domain aggregate for pure domain operations (e.g. tests
   * that exercise invariants without a tenant context).
   */
  readonly empresaSlug?: string;
  readonly atualizadoEm?: Date;
}

/**
 * Aggregate root for presentation rules of a project (data-model §2.2–§2.3).
 * Implements COMP-006.
 *
 * Pure TypeScript — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * One instance per project (UNIQUE projeto_id in DB).
 *
 * Lazy default (D-M): `materialized=false` when not yet persisted.
 * GetLayoutUseCase returns the default when no row is found — never 404.
 *
 * Typography bounds and heading order are enforced when `materialized=true`,
 * mirroring the CHECK constraints in data-model §2.2.
 *
 * Layout overrides reference manuscript nodes (read-only IMP; ADR-002, D-K).
 * Stale overrides (referenciaNo no longer in content tree) are excluded from
 * what PUB honours and returned separately in the preview-context response.
 */
export class ConfiguracaoLayout {
  readonly id: string;
  readonly projetoId: string;
  readonly fonte_corpo_familia: 'serif' | 'sans-serif';
  readonly fonte_corpo_tamanho: number;
  readonly espacamento_linha: number;
  readonly margem_lateral: number;
  readonly h1_tamanho: number;
  readonly h2_tamanho: number;
  readonly h3_tamanho: number;
  readonly overrides: ReadonlyArray<LayoutOverride>;
  readonly materialized: boolean;
  readonly empresaSlug: string;
  readonly atualizadoEm: Date;

  constructor(props: ConfiguracaoLayoutProps) {
    if (!props.projetoId) {
      throw new Error('ConfiguracaoLayout: projetoId is required');
    }
    // empresaSlug, if explicitly provided, must not be empty.
    if (props.empresaSlug !== undefined && !props.empresaSlug) {
      throw new Error('ConfiguracaoLayout: empresaSlug is required');
    }
    if (props.materialized) {
      ConfiguracaoLayout.assertMaterializedInvariants(props);
    }

    this.id = props.id ?? '';
    this.projetoId = props.projetoId;
    this.fonte_corpo_familia = props.fonte_corpo_familia;
    this.fonte_corpo_tamanho = props.fonte_corpo_tamanho;
    this.espacamento_linha = props.espacamento_linha;
    this.margem_lateral = props.margem_lateral;
    this.h1_tamanho = props.h1_tamanho;
    this.h2_tamanho = props.h2_tamanho;
    this.h3_tamanho = props.h3_tamanho;
    this.overrides = Object.freeze([...props.overrides]);
    this.materialized = props.materialized;
    this.empresaSlug = props.empresaSlug ?? '';
    this.atualizadoEm = props.atualizadoEm ?? new Date();
  }

  /**
   * Synthesizes a default (non-materialized) placeholder for a project.
   * Used by GetLayoutUseCase when no row is found (D-M).
   */
  static createDefault(projetoId: string, empresaSlug?: string): ConfiguracaoLayout {
    return new ConfiguracaoLayout({
      projetoId,
      ...DEFAULTS,
      overrides: [],
      materialized: false,
      empresaSlug,
    });
  }

  /**
   * Returns a new aggregate with the given typography/margin fields and
   * optionally a new override set applied, setting `materialized=true`.
   * Enforces all typography bounds and heading order invariants.
   *
   * @param fields    Subset of typography / margin fields to update.
   * @param overrides If provided, replaces the current override list.
   */
  update(
    fields: Partial<
      Pick<
        ConfiguracaoLayoutProps,
        | 'fonte_corpo_familia'
        | 'fonte_corpo_tamanho'
        | 'espacamento_linha'
        | 'margem_lateral'
        | 'h1_tamanho'
        | 'h2_tamanho'
        | 'h3_tamanho'
      >
    >,
    overrides?: LayoutOverride[],
  ): ConfiguracaoLayout {
    return new ConfiguracaoLayout({
      ...this.toProps(),
      ...fields,
      overrides: overrides ?? [...this.overrides],
      atualizadoEm: new Date(),
      materialized: true,
    });
  }

  /**
   * Returns a copy with overrides validated against the given set of existing
   * node references. Overrides whose referenciaNo is absent are marked stale
   * (referenciaNo no longer in the IMP content tree, D-K).
   */
  withValidatedOverrides(existingNodeIds: Set<string>): ConfiguracaoLayout {
    const validated = this.overrides.map(o =>
      existingNodeIds.has(o.referenciaNo) ? o : o.markStale(),
    );
    return new ConfiguracaoLayout({ ...this.toProps(), overrides: validated });
  }

  /** Overrides whose referenciaNo is present in the content tree — what PUB honours. */
  activeOverrides(): ReadonlyArray<LayoutOverride> {
    return this.overrides.filter(o => !o.stale);
  }

  /** Overrides flagged as stale — returned to the UI for editor warnings. */
  staleOverrides(): ReadonlyArray<LayoutOverride> {
    return this.overrides.filter(o => o.stale);
  }

  /**
   * Returns true when applying the given typography fields and override set
   * would produce no observable change to the persisted state, ignoring the
   * runtime-only `stale` flag.
   *
   * Used by UpdateLayoutUseCase for idempotency (COMP-007, SPEC-05): if
   * equalsInput() returns true the use case skips upsert and event emission.
   *
   * @param tipografia  Subset of typography fields from the request body
   *                    (undefined = field not provided, treated as "unchanged").
   * @param overrides   Complete override set from the request (stale flags
   *                    are ignored — only referenciaNo/tipo/alinhamento/ordem
   *                    are compared).
   */
  equalsInput(
    tipografia: Partial<
      Pick<
        ConfiguracaoLayoutProps,
        | 'fonte_corpo_familia'
        | 'fonte_corpo_tamanho'
        | 'espacamento_linha'
        | 'margem_lateral'
        | 'h1_tamanho'
        | 'h2_tamanho'
        | 'h3_tamanho'
      >
    >,
    overrides: ReadonlyArray<LayoutOverride>,
  ): boolean {
    // Compare each explicitly provided typography field.
    if (tipografia.fonte_corpo_familia !== undefined && this.fonte_corpo_familia !== tipografia.fonte_corpo_familia) return false;
    if (tipografia.fonte_corpo_tamanho !== undefined && this.fonte_corpo_tamanho !== tipografia.fonte_corpo_tamanho) return false;
    if (tipografia.espacamento_linha !== undefined && this.espacamento_linha !== tipografia.espacamento_linha) return false;
    if (tipografia.margem_lateral !== undefined && this.margem_lateral !== tipografia.margem_lateral) return false;
    if (tipografia.h1_tamanho !== undefined && this.h1_tamanho !== tipografia.h1_tamanho) return false;
    if (tipografia.h2_tamanho !== undefined && this.h2_tamanho !== tipografia.h2_tamanho) return false;
    if (tipografia.h3_tamanho !== undefined && this.h3_tamanho !== tipografia.h3_tamanho) return false;

    // Compare override sets ignoring stale (runtime-only field).
    if (this.overrides.length !== overrides.length) return false;

    const toKey = (o: LayoutOverride): string =>
      `${o.referenciaNo}\0${o.tipo}\0${o.alinhamento ?? ''}\0${o.ordem}`;

    const existingKeys = new Set(Array.from(this.overrides).map(toKey));
    return overrides.every(o => existingKeys.has(toKey(o)));
  }

  private toProps(): ConfiguracaoLayoutProps {
    return {
      id: this.id || undefined,
      projetoId: this.projetoId,
      fonte_corpo_familia: this.fonte_corpo_familia,
      fonte_corpo_tamanho: this.fonte_corpo_tamanho,
      espacamento_linha: this.espacamento_linha,
      margem_lateral: this.margem_lateral,
      h1_tamanho: this.h1_tamanho,
      h2_tamanho: this.h2_tamanho,
      h3_tamanho: this.h3_tamanho,
      overrides: [...this.overrides],
      materialized: this.materialized,
      empresaSlug: this.empresaSlug || undefined,
      atualizadoEm: this.atualizadoEm,
    };
  }

  private static assertMaterializedInvariants(props: ConfiguracaoLayoutProps): void {
    // Delegates to VO constructors which throw DomainException on violation.
    // Instantiating the VO is the validation — values are not stored here.
    void new FonteCorpo(props.fonte_corpo_tamanho);
    void new EspacamentoLinha(props.espacamento_linha);
    void new MargemLateral(props.margem_lateral);
    void new HeadingSize('h1_tamanho', props.h1_tamanho);
    void new HeadingSize('h2_tamanho', props.h2_tamanho);
    void new HeadingSize('h3_tamanho', props.h3_tamanho);
    validateHeadingOrder(props.h1_tamanho, props.h2_tamanho, props.h3_tamanho);
  }
}

// Re-export for consumers that previously imported from this module.
export { DomainException };
