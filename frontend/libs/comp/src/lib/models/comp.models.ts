/**
 * comp.models.ts — domain types for the COMP module.
 * Reconciled with api-contract.md §2–7 (MetadadosDto, ConfiguracaoLayoutDto, PreviewContextDto).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */

// ── Metadados ─────────────────────────────────────────────────────────────────

export type MetadadosIdioma = 'pt' | 'en' | 'es' | 'fr';

/**
 * api-contract §4.1 / §5.1 — Metadados do projeto editorial.
 * Singleton 1:1 with projetoId. Defaults lazy (materialized:false until first PUT).
 */
export interface MetadadosDto {
  projetoId?: string;
  titulo: string;
  autor: string;
  isbn: string | null;
  idioma: MetadadosIdioma;
  categoria: string | null;
  capaUrl: string | null;
  materialized: boolean;
}

// ── ConfiguracaoLayout ────────────────────────────────────────────────────────

export type FonteCorpoFamilia = 'serif' | 'sans-serif';
export type Alinhamento = 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita';

/**
 * api-contract §4.2 / §5.2 — Configuração de layout tipográfico.
 * Singleton 1:1 with projetoId. Defaults lazy.
 */
export interface ConfiguracaoLayoutDto {
  projetoId?: string;
  fonteCorpoFamilia: FonteCorpoFamilia;
  fonteCorpoTamanho: number;
  espacamentoLinha: number;
  margemLateral: number;
  h1Tamanho: number;
  h2Tamanho: number;
  h3Tamanho: number;
  materialized: boolean;
}

/** Layout override for a single image node (api-contract §4.2 §7.2). */
export interface LayoutOverride {
  nodeId: string;
  tipo: 'imagem';
  alinhamento: Alinhamento;
}

// ── PreviewContext ────────────────────────────────────────────────────────────

/**
 * Represents one page/node from the manuscript content tree.
 * Source: GET /api/comp/projetos/{projetoId}/preview-context.
 * FE never renders tipo='em-branco' (structuralEdits=false — FE ADR-COMP-001).
 */
export interface PreviewNode {
  nodeId: string;
  tipo: 'capitulo' | 'imagem';
  n: number;
  titulo: string;
  /** Body text (chapters only). Paragraphs separated by '\n\n'. */
  texto?: string;
  /** Resolved alignment for image nodes (from overrides or default 'centralizado'). */
  alinhamento?: Alinhamento;
}

/**
 * api-contract §4.4 — preview-context response.
 * FE reads this once per route entry and derives local paginas signal.
 */
export interface PreviewContextDto {
  projetoId: string;
  arvore: PreviewNode[];
  layout: ConfiguracaoLayoutDto;
  overrides: LayoutOverride[];
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** Response from POST /api/comp/projetos/{projetoId}/capa (api-contract §4.3). */
export interface CapaUploadResponse {
  capaUrl: string;
}
