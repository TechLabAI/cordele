/**
 * publicacao.port.ts — Port interface for the PUB Publicacao resource.
 *
 * Covers api-contract §4.1–4.5:
 *   POST /api/pub/projetos/{projetoId}/publicacoes             → trigger (202 idempotent, D-R)
 *   GET  /api/pub/projetos/{projetoId}/publicacoes/{id}/status → pollStatus (bounded poll, D-N)
 *   GET  /api/pub/projetos/{projetoId}/publicacoes             → list (T08 history)
 *   GET  /api/pub/projetos/{projetoId}/publicacoes/{id}/download → getDownloadUrl (signed URL, D-F)
 *   GET  /api/pub/projetos/{projetoId}/publicacoes/stats       → getStats (KPI, D-O)
 *
 * NOT included (per backlog constraints):
 *   §4.6 — listAvisosDetalhados: BLOCKED (INT-FE-PUB-004 awaiting ratification of PUB-016 BE).
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
} from '../models/pub.models';

export interface PublicacaoPort {
  /**
   * POST /api/pub/projetos/{projetoId}/publicacoes
   * Trigger export. Returns 202 with PublicacaoStatus (gerando) on new build, or
   * 200 with the in-flight record when a build is already non-terminal (D-R idempotent).
   * 409 manuscript-missing | 422 metadata-incomplete → propagated as errors.
   */
  triggerExport(projetoId: string): Observable<PublicacaoStatus>;

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/status
   * Single poll tick. Caller (ExportFacade) drives the bounded retry loop honouring Retry-After.
   * Returns the current PublicacaoStatus until terminal (publicado | com_erros).
   */
  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus>;

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes
   * Full publication history, newest first. Used by T08 DownloadEHistoricoComponent.
   */
  list(projetoId: string): Observable<PublicacaoHistoryItem[]>;

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download
   * Mint a short-TTL signed URL (D-F). SPA opens it directly; never proxies bytes.
   * 409 artifact-not-available if epubcheckStatus ∈ {erros_criticos, pendente}.
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl>;

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/stats
   * Live KPI projection from Publicacao rows (D-O). Used by T07/T08 KPI cards (if source lands).
   */
  getStats(projetoId: string): Observable<PublicationStats>;
}

export const PUBLICACAO_PORT = new InjectionToken<PublicacaoPort>('PubPublicacaoPort');
