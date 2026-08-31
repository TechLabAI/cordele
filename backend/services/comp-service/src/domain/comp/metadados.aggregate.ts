import { type Idioma, IdiomaVO, IDIOMA_PADRAO, IDIOMAS_VALIDOS } from './value-objects/idioma.vo';
import { NonBlankText } from './value-objects/non-blank-text.vo';

// Re-exports for consumers of this module.
export type { Idioma };
export { IDIOMAS_VALIDOS, IDIOMA_PADRAO };
export { DomainException } from '../shared/domain-exception';

/** @deprecated Use `Idioma` from this module or from `value-objects/idioma.vo`. */
export type IdiomaValido = Idioma;

export interface MetadadosProps {
  readonly id?: string;
  readonly projetoId: string;
  readonly titulo: string;
  readonly autor: string;
  readonly idioma: Idioma;
  readonly isbn?: string | null;
  readonly categoria?: string | null;
  readonly capaUrl?: string | null;
  readonly editoraNome?: string | null;
  readonly atualizadoEm?: Date;
  readonly empresaSlug: string;
  readonly materialized: boolean;
}

/**
 * Aggregate root for editorial identity of a project (data-model §2.1).
 *
 * Pure TypeScript — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * One instance per project (UNIQUE projeto_id in DB).
 *
 * Lazy default (D-M): `materialized=false` when the row has not been persisted
 * yet. GetMetadadosUseCase returns a default when none is found — never 404.
 *
 * Invariants (titulo, autor, idioma) are enforced only when `materialized=true`.
 * This allows the lazy placeholder to carry empty fields without violating the
 * domain rules that the DB enforces on persisted rows.
 *
 * The `empresaSlug` field carries the owning tenant identifier so repository
 * adapters can apply `SET search_path = emp_{slug}` without coupling the
 * use case to infrastructure (RULE-07).
 *
 * Validation is delegated to `IdiomaVO` and `NonBlankText` value objects —
 * no inline validation logic.
 */
export class Metadados {
  readonly id: string;
  readonly projetoId: string;
  readonly titulo: string;
  readonly autor: string;
  readonly idioma: Idioma;
  readonly isbn: string | null;
  readonly categoria: string | null;
  readonly capaUrl: string | null;
  readonly editoraNome: string | null;
  readonly atualizadoEm: Date;
  /** Owning tenant — used by the repository adapter for schema routing. */
  readonly empresaSlug: string;
  /** false when synthesized from defaults (D-M); true when persisted at least once. */
  readonly materialized: boolean;

  constructor(props: MetadadosProps) {
    if (!props.projetoId) {
      throw new Error('Metadados: projetoId is required');
    }
    if (!props.empresaSlug) {
      throw new Error('Metadados: empresaSlug is required');
    }
    if (props.materialized) {
      Metadados.assertMaterializedInvariants(props);
    }
    this.id = props.id ?? '';
    this.projetoId = props.projetoId;
    this.titulo = props.titulo;
    this.autor = props.autor;
    this.idioma = props.idioma;
    this.isbn = props.isbn ?? null;
    this.categoria = props.categoria ?? null;
    this.capaUrl = props.capaUrl ?? null;
    this.editoraNome = props.editoraNome ?? null;
    this.atualizadoEm = props.atualizadoEm ?? new Date();
    this.empresaSlug = props.empresaSlug;
    this.materialized = props.materialized;
  }

  /**
   * Synthesizes a non-materialized placeholder for a project with a known tenant.
   *
   * Used by GetMetadadosUseCase when no row is found (D-M).
   * The placeholder is never persisted — it exists only in the response.
   */
  static defaultsFor(projetoId: string, empresaSlug: string): Metadados {
    return new Metadados({
      projetoId,
      titulo: '',
      autor: '',
      idioma: IDIOMA_PADRAO,
      empresaSlug,
      materialized: false,
    });
  }

  /**
   * Synthesizes a non-materialized placeholder for a project.
   *
   * Convenience factory matching the COMP-003 spec API. The `empresaSlug` is set
   * to the sentinel `'_default_'` (a valid non-empty string; the placeholder is
   * never persisted). When the owning tenant is known, prefer
   * `defaultsFor(projetoId, slug)`.
   */
  static createDefault(projetoId: string): Metadados {
    return Metadados.defaultsFor(projetoId, '_default_');
  }

  /**
   * Returns a new aggregate with the given field changes and `materialized=true`.
   *
   * Enforces all invariants (titulo, autor, idioma) because the result will be persisted.
   */
  update(changes: {
    titulo?: string;
    autor?: string;
    idioma?: Idioma;
    isbn?: string | null;
    categoria?: string | null;
  }): Metadados {
    return new Metadados({
      ...this.toProps(),
      ...changes,
      atualizadoEm: new Date(),
      materialized: true,
    });
  }

  /**
   * Returns a new aggregate with `capaUrl` set.
   *
   * Does NOT change `materialized` — cover upload is independent of metadata PUT.
   */
  withCapaUrl(capaUrl: string): Metadados {
    return new Metadados({
      ...this.toProps(),
      capaUrl,
      atualizadoEm: new Date(),
    });
  }

  /**
   * Returns a new aggregate with `capaUrl` cleared (null).
   *
   * Idempotent — safe to call when no cover is set.
   */
  withoutCapa(): Metadados {
    return new Metadados({
      ...this.toProps(),
      capaUrl: null,
      atualizadoEm: new Date(),
    });
  }

  private toProps(): MetadadosProps {
    return {
      id: this.id || undefined,
      projetoId: this.projetoId,
      titulo: this.titulo,
      autor: this.autor,
      idioma: this.idioma,
      isbn: this.isbn,
      categoria: this.categoria,
      capaUrl: this.capaUrl,
      editoraNome: this.editoraNome,
      atualizadoEm: this.atualizadoEm,
      empresaSlug: this.empresaSlug,
      materialized: this.materialized,
    };
  }

  /**
   * Returns `true` when the given fields match the current aggregate state.
   *
   * Used by `UpdateMetadadosUseCase` to detect idempotent no-op updates
   * (COMP-004 — re-sending an identical body should not call `upsert` again).
   *
   * Only the five editable metadata fields are compared; `capaUrl`, `id`,
   * `atualizadoEm`, and `materialized` are not part of this comparison.
   *
   * Pure method — no side effects, no external imports (RULE-01/02).
   */
  hasSameContentAs(fields: {
    titulo: string;
    autor: string;
    idioma: Idioma;
    isbn?: string | null;
    categoria?: string | null;
  }): boolean {
    return (
      this.titulo === fields.titulo &&
      this.autor === fields.autor &&
      this.idioma === fields.idioma &&
      this.isbn === (fields.isbn ?? null) &&
      this.categoria === (fields.categoria ?? null)
    );
  }

  /**
   * Validates invariants that must hold for all persisted (materialized) rows.
   * Delegates to value objects — throws DomainException(422) on any violation.
   */
  private static assertMaterializedInvariants(props: MetadadosProps): void {
    NonBlankText.validate(props.titulo, 'titulo');
    NonBlankText.validate(props.autor, 'autor');
    IdiomaVO.validate(props.idioma as string);
  }
}

/**
 * Backward-compatibility alias.
 *
 * Callers that imported `MetadadosEntity` from `domain/metadados/metadados.entity`
 * only need to update the import path; the symbol rename is a separate step.
 *
 * @deprecated Use `Metadados` directly.
 */
export { Metadados as MetadadosEntity };
