/**
 * segmento-curadoria.port.ts — Port interface for editorial T04 actions (api-contract §8).
 * Track D: created from scratch by fe-architect-promote IMP @ cordele (D-494).
 *
 * Covers (addendum M4 §8):
 *   POST   /api/imp/manuscripts/{id}/segmentos/{segId}/ignore  → ignore (201|200 idempotent)
 *   DELETE /api/imp/manuscripts/{id}/segmentos/{segId}/ignore  → restore (204|404)
 *   GET    /api/imp/manuscripts/{id}/segmentos/ignored         → getIgnored
 *   POST   /api/imp/manuscripts/{id}/confirm-estrutura         → confirmEstrutura (200)
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { IgnoredSegmentsResponse, SegmentoCuradoriaDto } from '../models/imp.models';

export interface SegmentoCuradoriaPort {
  /**
   * Persist ignore annotation for an unparsed segment.
   * 201 on first ignore; 200 if already ignored (idempotent per api-contract §8.1).
   * On any 4xx/5xx the ReviewFacade MUST roll back the optimistic UI state.
   */
  ignore(manuscritoId: string, segmentoId: string): Observable<SegmentoCuradoriaDto>;

  /**
   * Remove ignore annotation — restore the segment.
   * Returns void (204 body is empty). Throws on 404 (segment was not ignored).
   * On any 4xx/5xx the ReviewFacade MUST roll back the optimistic UI state.
   */
  restoreIgnore(manuscritoId: string, segmentoId: string): Observable<void>;

  /** Fetch the current set of ignored segmentoIds for T04 hydration (deep-link path). */
  getIgnored(manuscritoId: string): Observable<IgnoredSegmentsResponse>;

  /**
   * Confirm structure review complete → advances ProjetoEditorial.status to em_composicao.
   * On success, navigate to COMP. On error, stay on T04 and show toast.
   */
  confirmEstrutura(manuscritoId: string): Observable<void>;
}

export const SEGMENTO_CURADORIA_PORT = new InjectionToken<SegmentoCuradoriaPort>(
  'SegmentoCuradoriaPort',
);
