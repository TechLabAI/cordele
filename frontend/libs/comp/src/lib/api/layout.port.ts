/**
 * layout.port.ts — Port interface for the Layout + Preview resources.
 * Covers api-contract §4.2 / §4.4:
 *   GET  /api/comp/projetos/{projetoId}/layout         → getLayout (T06 panel)
 *   PUT  /api/comp/projetos/{projetoId}/layout         → updateLayout (T06 style panel + alignment)
 *   GET  /api/comp/projetos/{projetoId}/preview-context → getPreviewContext (T06 pages)
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfiguracaoLayoutDto, PreviewContextDto } from '../models/comp.models';

export interface LayoutPort {
  /**
   * GET /api/comp/projetos/{projetoId}/layout
   * Returns current layout config or defaults (materialized:false).
   */
  getLayout(projetoId: string): Observable<ConfiguracaoLayoutDto>;

  /**
   * PUT /api/comp/projetos/{projetoId}/layout
   * Upsert layout parameters and/or image alignment overrides.
   * Only parameters honoured by PUB stylesheet (§7.3) are persisted.
   */
  updateLayout(projetoId: string, dto: Partial<ConfiguracaoLayoutDto>): Observable<ConfiguracaoLayoutDto>;

  /**
   * GET /api/comp/projetos/{projetoId}/preview-context
   * Returns manuscript tree + layout + overrides.
   * FE renders the preview client-side — never calls imp-service (D-K).
   */
  getPreviewContext(projetoId: string): Observable<PreviewContextDto>;
}

export const LAYOUT_PORT = new InjectionToken<LayoutPort>('LayoutPort');
