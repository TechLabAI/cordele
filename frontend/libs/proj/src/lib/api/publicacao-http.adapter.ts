/**
 * publicacao-http.adapter.ts — HTTP adapter stub for PublicacaoPort.
 * URLs from api-contract.md §4.4–4.5 (base path /api/proj/projetos).
 * D-F: getDownloadUrl returns signed URL; SPA opens it directly (no proxy).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import { PublicacaoHistoryItem, SignedDownloadUrl } from '../models/proj.models';
import { PublicacaoPort } from './publicacao.port';

@Injectable({ providedIn: 'root' })
export class PublicacaoHttpAdapter implements PublicacaoPort {
  /** AccessHttpClient (not HttpClient) — X-Empresa-Id header added automatically (RULE-NX-05). */
  private readonly http = inject(AccessHttpClient);
  /** Derives from ACCESS_HTTP_BASE via moduleBase() — /v1 prefix lives in one place. */
  private readonly base = `${moduleBase('proj')}/projetos`;

  /** GET /api/proj/projetos/{projetoId}/publicacoes — publication history (T08). */
  list(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    return this.http.get<PublicacaoHistoryItem[]>(`${this.base}/${projetoId}/publicacoes`);
  }

  /**
   * GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download (api-contract §4.5).
   * Returns short-TTL signed URL. 409 for erros_criticos/pendente. D-F: no proxy.
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.http.get<SignedDownloadUrl>(
      `${this.base}/${projetoId}/publicacoes/${publicacaoId}/download`,
    );
  }
}
