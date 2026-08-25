/**
 * publicacao-http.adapter.ts — HTTP adapter for PublicacaoPort (stub; activate with adapter='http').
 *
 * Endpoints follow api-contract §4.1–4.5. Retry-After header from pollStatus responses
 * is parsed by ExportFacade's bounded poll loop, not here.
 *
 * STUB: compilable, not yet wired to a real backend.
 * Full implementation: FE-PUB-009 / FE-PUB-010 (Layer 2).
 * INT-FE-PUB-004 (§4.6 avisos detail): NOT implemented — blocked awaiting BE ratification.
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
} from '../models/pub.models';
import { PublicacaoPort } from './publicacao.port';

@Injectable({ providedIn: 'root' })
export class PublicacaoHttpAdapter implements PublicacaoPort {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/pub';

  private projectBase(projetoId: string): string {
    return `${this.base}/projetos/${projetoId}/publicacoes`;
  }

  triggerExport(projetoId: string): Observable<PublicacaoStatus> {
    // POST 202 (new build) or 200 (idempotent in-flight, D-R)
    return this.http.post<PublicacaoStatus>(this.projectBase(projetoId), {});
  }

  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus> {
    return this.http.get<PublicacaoStatus>(
      `${this.projectBase(projetoId)}/${publicacaoId}/status`,
    );
  }

  list(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    return this.http.get<PublicacaoHistoryItem[]>(this.projectBase(projetoId));
  }

  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.http.get<SignedDownloadUrl>(
      `${this.projectBase(projetoId)}/${publicacaoId}/download`,
    );
  }

  getStats(projetoId: string): Observable<PublicationStats> {
    return this.http.get<PublicationStats>(`${this.projectBase(projetoId)}/stats`);
  }
}
