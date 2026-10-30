/**
 * comp.models.ts — domain types for the COMP module.
 * Reconciled with api-contract.md §2–7 (MetadadosDto, ConfiguracaoLayoutDto, PreviewContextDto).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Moved to @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
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

/**
 * api-contract §4.6 — PUT /layout body.
 * Typography params + image-alignment overrides (tipo='imagem' only).
 * Never send tipo='em-branco' (ADR-COMP-001 / D-H).
 */
export interface UpsertLayoutBody {
  fonteCorpoFamilia: FonteCorpoFamilia;
  fonteCorpoTamanho: number;
  espacamentoLinha: number;
  margemLateral: number;
  h1Tamanho: number;
  h2Tamanho: number;
  h3Tamanho: number;
  overrides: LayoutOverride[];
}

// ── PreviewContext ────────────────────────────────────────────────────────────

/**
 * api-contract §4.7 — GET /preview-context response.
 * Contains the full manuscript tree + current layout + override list.
 * FE renders client-side; never calls imp-service (D-K).
 */
export interface PreviewContextDto {
  projetoId: string;
  arvore: PreviewNode[];
  layout: ConfiguracaoLayoutDto;
  overrides: LayoutOverride[];
}

/**
 * A node in the manuscript tree (api-contract §3 / §7.1).
 * tipo: 'capitulo' | 'imagem' — extensible; FE renders what it knows, ignores the rest.
 */
export interface PreviewNode {
  nodeId: string;
  tipo: 'capitulo' | 'imagem';
  n?: number;
  titulo?: string;
  texto?: string;
  src?: string;
  alinhamento?: Alinhamento;
}

// ── Metadados mutations ───────────────────────────────────────────────────────

/** PUT /api/comp/projetos/{projetoId}/metadados request body. */
export type UpsertMetadadosDto = Partial<Omit<MetadadosDto, 'projetoId' | 'capaUrl' | 'materialized'>>;

/** POST /api/comp/projetos/{projetoId}/capa response (201). */
export interface CapaUploadResponse {
  capaUrl: string;
}
