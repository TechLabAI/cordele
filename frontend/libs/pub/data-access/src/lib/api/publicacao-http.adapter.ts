/**
 * publicacao-http.adapter.ts — HTTP adapter for PublicacaoPort (real backend integration).
 * FE-PUB-009 / FE-PUB-010 — real impl replacing the stub from the flat lib.
 *
 * RULE-NX-05: no raw HttpClient injection — extends AccessHttpClient from
 * @cordele/shared/access-http-base, which automatically adds X-Empresa-Id header
 * on every request via the ACCESS_EMPRESA_ID injection token.
 *
 * Endpoints follow api-contract §4.1–4.5:
 *   POST /api/pub/projetos/{id}/publicacoes       — trigger (§4.1)
 *   GET  /api/pub/projetos/{id}/publicacoes/{id}/status  — poll (§4.2)
 *   GET  /api/pub/projetos/{id}/publicacoes       — history list (§4.3)
 *   GET  /api/pub/projetos/{id}/publicacoes/{id}/download — signed URL (§4.4)
 *   GET  /api/pub/projetos/{id}/publicacoes/stats — KPIs (§4.5)
 *
 * INT-FE-PUB-004 (§4.6 avisos detail): NOT implemented — blocked awaiting BE ratification.
 *
 * isMock: false — this adapter calls the real pub-service.
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AccessHttpClient } from '@cordele/shared/access-http-base';
import {
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
} from '../models/pub.models';
import { PublicacaoPort } from './publicacao.port';

@Injectable({ providedIn: 'root' })
export class PublicacaoHttpAdapter extends AccessHttpClient implements PublicacaoPort {
  /** isMock: false — this adapter integrates with the real pub-service. */
  readonly isMock = false;

  private readonly base = '/api/pub';

  private projectBase(projetoId: string): string {
    return `${this.base}/projetos/${projetoId}/publicacoes`;
  }

  /**
   * POST /api/pub/projetos/{projetoId}/publicacoes — trigger export.
   * 202 Accepted (new build) or 200 OK (idempotent in-flight, D-R).
   * Both return PublicacaoStatus with status=gerando.
   */
  triggerExport(projetoId: string): Observable<PublicacaoStatus> {
    return this.post<PublicacaoStatus>(this.projectBase(projetoId), {});
  }

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/status
   * Single poll tick — X-Empresa-Id header added automatically by AccessHttpClient.
   */
  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus> {
    return this.get<PublicacaoStatus>(
      `${this.projectBase(projetoId)}/${publicacaoId}/status`,
    );
  }

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes — history list (newest-first from BE).
   */
  list(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    return this.get<PublicacaoHistoryItem[]>(this.projectBase(projetoId));
  }

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download
   * Mints a short-TTL signed URL. Browser opens it; SPA never proxies bytes (D-F).
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.get<SignedDownloadUrl>(
      `${this.projectBase(projetoId)}/${publicacaoId}/download`,
    );
  }

  /**
   * GET /api/pub/projetos/{projetoId}/publicacoes/stats
   * Live KPI projection (§4.5 / D-O).
   */
  getStats(projetoId: string): Observable<PublicationStats> {
    return this.get<PublicationStats>(`${this.projectBase(projetoId)}/stats`);
  }
}
