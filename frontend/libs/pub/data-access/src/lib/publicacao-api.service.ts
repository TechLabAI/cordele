/**
 * publicacao-api.service.ts — Application service facade over PublicacaoPort (FE-PUB-008).
 *
 * Wraps the injected PublicacaoPort (token PUBLICACAO_PORT) and provides the
 * higher-level API consumed by ExportFacade and HistoryFacade.
 * Facades call this service; they do NOT inject PUBLICACAO_PORT directly.
 *
 * RULE-NX-05: no raw HttpClient. HTTP lives in PublicacaoHttpAdapter (extends AccessHttpClient).
 * Cross-context: getProjetoHeader (PROJ) and getAutor (COMP) are stubbed here for P2;
 *               they will be wired to the real cross-service calls in P4 (INT-FE-PUB-002/003).
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PUBLICACAO_PORT } from './api/publicacao.port';
import {
  ProjetoHeaderInfo,
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
} from './models/pub.models';

@Injectable({ providedIn: 'root' })
export class PublicacaoApiService {
  private readonly port = inject(PUBLICACAO_PORT);

  // ─── §4.1 — Trigger export ───────────────────────────────────────────────

  /**
   * Trigger a new export build.
   * 202 Accepted (new build) or 200 OK (in-flight idempotent, D-R).
   * Both return PublicacaoStatus{status=gerando}.
   */
  triggerExport(projetoId: string): Observable<PublicacaoStatus> {
    return this.port.triggerExport(projetoId);
  }

  // ─── §4.2 — Poll status ───────────────────────────────────────────────────

  /**
   * Single poll tick (GET status). ExportFacade drives the bounded retry loop.
   * Caller honours Retry-After hint (passed from the response header by the adapter).
   */
  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus> {
    return this.port.pollStatus(projetoId, publicacaoId);
  }

  // ─── §4.3 — History list ─────────────────────────────────────────────────

  /**
   * Full publication history for a project, newest first (server-ordered).
   * Used by T08 DownloadEHistoricoComponent and resume-on-reentry (SPEC-04 §3).
   */
  listByProjeto(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    return this.port.list(projetoId);
  }

  // ─── §4.4 — Signed download URL ──────────────────────────────────────────

  /**
   * Mint a fresh short-TTL signed URL (D-F).
   * ArtifactDownloadService calls this before opening; it never reuses a stale URL.
   */
  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.port.getDownloadUrl(projetoId, publicacaoId);
  }

  // ─── §4.5 — Publication stats (KPIs) ─────────────────────────────────────

  /**
   * Live KPI projection (D-O). Tiles are hidden when fields are null (INT-FE-PUB-005).
   */
  getStats(projetoId: string): Observable<PublicationStats> {
    return this.port.getStats(projetoId);
  }

  // ─── Cross-context — wired in P4 ─────────────────────────────────────────

  /**
   * GET /api/proj/projetos/{projetoId} — project header (name, status, editora).
   * INT-FE-PUB-002 (P4): provides real cross-context data when an injection token
   * override is registered in app.config.ts (PUB_PROJETO_HEADER_FN token).
   * Default (no override): returns null — HistoryFacade renders gracefully without header.
   *
   * Nx boundary note: pub-data-access (scope:pub) cannot import scope:proj directly.
   * The real ProjetoApiService call is wired via app.config.ts using the app layer
   * (type:app has no scope restriction and can import scope:proj).
   */
  getProjetoHeader(_projetoId: string): Observable<ProjetoHeaderInfo | null> {
    // Stub: real wiring requires cross-scope injection token (see empresa-changed.token pattern).
    // INT-FE-PUB-002: actual HTTP call is ProjetoApiService.getProjeto(projetoId) → map to ProjetoHeaderInfo.
    // Cannot be wired here (pub-data-access scope:pub cannot import scope:proj — .eslintrc.json).
    return new Observable(observer => { observer.next(null); observer.complete(); });
  }

  /**
   * Metadata subtitle (autor) from COMP (GET /api/comp/projetos/{projetoId}/metadados).
   * INT-FE-PUB-003 (P4): provides real cross-context data when an injection token
   * override is registered in app.config.ts (PUB_AUTOR_FN token).
   * Default (no override): returns null — HistoryFacade renders gracefully without autor.
   *
   * Nx boundary note: pub-data-access (scope:pub) cannot import scope:comp directly.
   * The real MetadadosHttpAdapter call is wired via app.config.ts using the app layer.
   */
  getAutor(_projetoId: string): Observable<string | null> {
    // Stub: real wiring requires cross-scope injection token.
    // INT-FE-PUB-003: actual HTTP call is MetadadosHttpAdapter.get(projetoId) → map to autor string.
    // Cannot be wired here (pub-data-access scope:pub cannot import scope:comp — .eslintrc.json).
    return new Observable(observer => { observer.next(null); observer.complete(); });
  }
}
