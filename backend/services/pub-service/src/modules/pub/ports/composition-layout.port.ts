/** One honoured, non-stale image-alignment override (comp api-contract §6.3). */
export interface LayoutOverrideRead {
  readonly id: string;
  readonly referenciaNo: string;
  readonly tipo: 'imagem' | 'em-branco';
  readonly alinhamento: 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita' | null;
  readonly ordem: number;
}

/** Persisted `ConfiguracaoLayout` (comp api-contract §6.2), honoured non-stale overrides only. */
export interface LayoutRead {
  readonly projetoId: string;
  readonly fonteCorpoFamilia: 'serif' | 'sans-serif';
  readonly fonteCorpoTamanho: number;
  readonly espacamentoLinha: number;
  readonly margemLateral: number;
  readonly h1Tamanho: number;
  readonly h2Tamanho: number;
  readonly h3Tamanho: number;
  readonly overrides: readonly LayoutOverrideRead[];
}

/**
 * Outbound port: layout configuration honoured by the ePub stylesheet, owned
 * by COMP's `GetConfiguracaoLayoutUseCase` (integration-contracts.md §2.3,
 * D-I).
 *
 * `null` is not a failure: PUB assembles with COMP's documented defaults
 * (comp api-contract §7.2) — only metadata is required at export.
 *
 * Stub adapter binds in P4 (PUB-012); real adapter in P6 (INT-PUB-002). P2
 * use cases are tested against Jest mocks of this interface.
 */
export interface CompositionLayoutPort {
  get(projetoId: string): Promise<LayoutRead | null>;
}

/** DI injection token for CompositionLayoutPort. Re-exported by pub.tokens.ts. */
export const CompositionLayoutPort = Symbol('CompositionLayoutPort');
