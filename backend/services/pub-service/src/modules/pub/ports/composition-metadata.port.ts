/** Persisted `Metadados` (comp api-contract §6.1 minus `materialized`). */
export interface MetadadosRead {
  readonly projetoId: string;
  readonly titulo: string | null;
  readonly autor: string | null;
  readonly isbn: string | null;
  readonly idioma: string | null;
  readonly categoria: string | null;
  readonly capaUrl: string | null;
  readonly editoraNome: string | null;
  readonly atualizadoEm: string;
}

/**
 * Outbound port: editorial metadata, owned by COMP's `GetMetadadosUseCase`
 * (integration-contracts.md §2.2, D-I).
 *
 * `null` means the project's composition was never saved — the export
 * pre-flight rejects with 422 metadata-incomplete (api-contract §7.1); PUB
 * validates presence of `titulo`/`autor`/`idioma`, COMP does not.
 *
 * Stub adapter binds in P4 (PUB-012); real adapter in P6 (INT-PUB-002). P2
 * use cases are tested against Jest mocks of this interface.
 */
export interface CompositionMetadataPort {
  get(projetoId: string): Promise<MetadadosRead | null>;
}

/** DI injection token for CompositionMetadataPort. Re-exported by pub.tokens.ts. */
export const CompositionMetadataPort = Symbol('CompositionMetadataPort');
