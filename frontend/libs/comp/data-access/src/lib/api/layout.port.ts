/**
 * layout.port.ts — Port interface for the Layout + Preview resources.
 * Covers api-contract §4.5/§4.6/§4.7:
 *   GET  /api/comp/projetos/{projetoId}/layout          → getLayout (T06 panel)
 *   PUT  /api/comp/projetos/{projetoId}/layout          → upsertLayout (T06 export — pessimistic)
 *   GET  /api/comp/projetos/{projetoId}/preview-context → getPreviewContext (T06 pages)
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-007 — added UpsertLayoutBody; renamed updateLayout → upsertLayout (P2).
 * Moved to @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfiguracaoLayoutDto, PreviewContextDto, UpsertLayoutBody } from '../models/comp.models';

export interface LayoutPort {
  /**
   * GET /api/comp/projetos/{projetoId}/layout
   * Returns current layout config or defaults (materialized:false).
   */
  getLayout(projetoId: string): Observable<ConfiguracaoLayoutDto>;

  /**
   * PUT /api/comp/projetos/{projetoId}/layout (api-contract §4.6 / D-H).
   * Body: typography params + non-stale image-alignment overrides (tipo='imagem' only).
   * NEVER sends tipo='em-branco'. Await 200 before navigating (pessimistic).
   */
  upsertLayout(projetoId: string, body: UpsertLayoutBody): Observable<ConfiguracaoLayoutDto>;

  /**
   * GET /api/comp/projetos/{projetoId}/preview-context
   * Returns manuscript tree + layout + overrides.
   * FE renders the preview client-side — never calls imp-service (D-K).
   * 409 urn:cordele:comp:manuscript-missing if no manuscript imported.
   */
  getPreviewContext(projetoId: string): Observable<PreviewContextDto>;
}

export const LAYOUT_PORT = new InjectionToken<LayoutPort>('LayoutPort');
