/**
 * manuscrito.port.ts — Port interface for the Manuscrito resource (api-contract §4.1–4.4).
 * Track D: created from scratch by fe-architect-promote IMP @ cordele (D-494).
 *
 * Covers:
 *   POST /api/imp/manuscripts                          → create (synchronous parse, D-A)
 *   GET  /api/imp/manuscripts/{id}                    → get (reload / deep-link)
 *   GET  /api/imp/manuscripts/{id}/estrutura          → getEstrutura (content tree only)
 *   GET  /api/imp/projetos/{projetoId}/manuscritos    → listByProjeto (history)
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContentTree,
  ManuscritoDetail,
  ManuscritoSummary,
  UploadParams,
} from '../models/imp.models';

export interface ManuscritoPort {
  /** Upload file + synchronous parse → returns 201 ManuscritoDetail (D-A).
   *  File + exactly one of {projetoTitulo | projetoId} (D-C).
   */
  create(params: UploadParams): Observable<ManuscritoDetail>;

  /** Read one manuscript — reload / deep-link / T04 hydration fallback. */
  get(manuscritoId: string): Observable<ManuscritoDetail>;

  /** Content tree only (lighter than full ManuscritoDetail). */
  getEstrutura(manuscritoId: string): Observable<ContentTree>;

  /** Immutable import history for a project (newest first). */
  listByProjeto(projetoId: string): Observable<ManuscritoSummary[]>;
}

export const MANUSCRITO_PORT = new InjectionToken<ManuscritoPort>('ManuscritoPort');
