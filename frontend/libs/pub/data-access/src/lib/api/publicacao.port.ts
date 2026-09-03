/**
 * publicacao.port.ts — Port interface for the PUB Publicacao resource.
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-009).
 *
 * Covers api-contract §4.1–4.6 (all paths versioned: /api/v1/pub/... — NestJS URI versioning):
 *   POST /api/v1/pub/projetos/{projetoId}/publicacoes                          → trigger (202 idempotent, D-R)
 *   GET  /api/v1/pub/projetos/{projetoId}/publicacoes/{id}/status              → pollStatus (bounded poll, D-N)
 *   GET  /api/v1/pub/projetos/{projetoId}/publicacoes                          → list (T08 history)
 *   GET  /api/v1/pub/projetos/{projetoId}/publicacoes/{id}/download            → getDownloadUrl (signed URL, D-F)
 *   GET  /api/v1/pub/projetos/{projetoId}/publicacoes/stats                    → getStats (KPI, D-O)
 *   GET  /api/v1/pub/projetos/{projetoId}/publicacoes/{id}/validation-messages → getValidationMessages (§4.6, INT-FE-PUB-004)
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
  ValidationMessageItem,
  ValidationMessageSeverity,
} from '../models/pub.models';

export interface PublicacaoPort {
  /**
   * POST /api/v1/pub/projetos/{projetoId}/publicacoes
   * Trigger export. Returns 202 with PublicacaoStatus (gerando) on new build, or
   * 200 with the in-flight record when a build is already non-terminal (D-R idempotent).
   * 409 manuscript-missing | 422 metadata-incomplete → propagated as errors.
   */
  triggerExport(projetoId: string): Observable<PublicacaoStatus>;

  /**
   * GET /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/status
   * Single poll tick. Caller (ExportFacade) drives the bounded retry loop honouring Retry-After.
   * Returns the current PublicacaoStatus until terminal (publicado | com_erros).
   */
  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus>;

  /**
   * GET /api/v1/pub/projetos/{projetoId}/publicacoes
   * Full publication history, newest first. Used by T08 DownloadEHistoricoComponent.
   */
  list(projetoId: string): Observable<PublicacaoHistoryItem[]>;

  /**
   * GET /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download
   * Mint a short-TTL signed URL (D-F). SPA opens it directly; never proxies bytes.
   * 409 artifact-not-available if epubcheckStatus ∈ {erros_criticos, pendente}.
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl>;

  /**
   * GET /api/v1/pub/projetos/{projetoId}/publicacoes/stats
   * Live KPI projection from Publicacao rows (D-O). Used by T07/T08 KPI cards (if source lands).
   */
  getStats(projetoId: string): Observable<PublicationStats>;

  /**
   * GET /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/validation-messages
   * Detailed epubcheck messages ordered by `ordem ASC` (api-contract §4.6 — INT-FE-PUB-004).
   *
   * `severity` is optional: when omitted all severities are returned.
   * 404 (urn:cordele:pub:publicacao-not-found) when publicacaoId does not belong
   * to the projetoId or the active empresa (cross-tenant guard — never reveals existence).
   */
  getValidationMessages(
    projetoId: string,
    publicacaoId: string,
    severity?: ValidationMessageSeverity,
  ): Observable<ValidationMessageItem[]>;
}

export const PUBLICACAO_PORT = new InjectionToken<PublicacaoPort>('PubPublicacaoPort');
