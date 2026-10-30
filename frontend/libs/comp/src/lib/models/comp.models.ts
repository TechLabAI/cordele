/**
 * comp.models.ts — re-export shim.
 * The actual type definitions live in @cordele/comp/data-access (P6 boundary fix).
 * This file is retained so internal relative imports within @cordele/comp
 * (facades, components) continue to resolve without path changes.
 * Track D: INT-FE-COMP-006 (P6).
 */
export type {
  MetadadosDto,
  MetadadosIdioma,
  ConfiguracaoLayoutDto,
  FonteCorpoFamilia,
  Alinhamento,
  LayoutOverride,
  UpsertLayoutBody,
  PreviewContextDto,
  PreviewNode,
  UpsertMetadadosDto,
  CapaUploadResponse,
} from '@cordele/comp/data-access';
