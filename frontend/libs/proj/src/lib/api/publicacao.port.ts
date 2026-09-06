/**
 * publicacao.port.ts — Port interface for the Publicacao resource.
 * Covers api-contract §4.4–4.5:
 *   GET /api/v1/proj/projetos/{projetoId}/publicacoes                               → list (T08 history)
 *   GET /api/v1/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download       → signed URL (D-F)
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { PublicacaoHistoryItem, SignedDownloadUrl } from '../models/proj.models';

export interface PublicacaoPort {
  /** GET .../publicacoes — publication history newest first (T08 list). */
  list(projetoId: string): Observable<PublicacaoHistoryItem[]>;

  /**
   * GET .../publicacoes/{publicacaoId}/download — mint a short-TTL signed URL (D-F).
   * 409 if epubcheckStatus ∈ {erros_criticos, pendente} (artifact not available).
   * The SPA opens the returned arquivoUrl directly — never proxies bytes (api-contract §4.5).
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl>;
}

export const PUBLICACAO_PORT = new InjectionToken<PublicacaoPort>('PublicacaoPort');
