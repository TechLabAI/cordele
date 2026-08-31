/**
 * metadados.port.ts — Port interface for the Metadados resource.
 * Covers api-contract §4.1 / §4.3:
 *   GET  /api/comp/projetos/{projetoId}/metadados  → get (T05 form pre-fill)
 *   PUT  /api/comp/projetos/{projetoId}/metadados  → update (T05 save / lazy materialise)
 *   POST /api/comp/projetos/{projetoId}/capa       → uploadCapa (T05 cover image ≤10MB)
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Moved to @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CapaUploadResponse, MetadadosDto } from '../models/comp.models';

export interface MetadadosPort {
  /**
   * GET /api/comp/projetos/{projetoId}/metadados
   * Returns current metadados or a default (materialized:false) if not yet written.
   */
  get(projetoId: string): Observable<MetadadosDto>;

  /**
   * PUT /api/comp/projetos/{projetoId}/metadados
   * Upsert — materialises defaults on first call (materialized:true in response).
   * 422 if titulo or idioma is blank.
   */
  update(projetoId: string, dto: Partial<MetadadosDto>): Observable<MetadadosDto>;

  /**
   * POST /api/comp/projetos/{projetoId}/capa (multipart/form-data field: file).
   * Accepted: image/jpeg | image/png | image/webp, ≤10MB.
   * 413 if size exceeded; 415 if content-type not accepted.
   */
  uploadCapa(projetoId: string, file: File): Observable<CapaUploadResponse>;

  /**
   * DELETE /api/comp/projetos/{projetoId}/capa
   * Clears capaUrl idempotently. Returns 204 No Content.
   */
  removeCapa(projetoId: string): Observable<void>;
}

export const METADADOS_PORT = new InjectionToken<MetadadosPort>('MetadadosPort');
