/**
 * projeto-api.service.ts — standardised HTTP client for the proj-service (7 endpoints).
 * Extends AccessHttpClient so every request carries X-Empresa-Id (multi-empresa contract).
 * FE-PROJ-007 / FE-PROJ-008 (P2).
 *
 * Base path: /api/v1/proj/projetos   (api-contract §4)
 * Mapping:   ProblemDetail → AppError via proj-api.mappers.ts
 *
 * api-contract §4.2 change (2026-09): listProjetos returns paginated envelope
 * { items, nextCursor } — not flat ProjetoCard[]. Updated to use getResponse()
 * so that the X-Degraded header is also captured without injecting HttpClient
 * directly (RULE-NX-05 compliance).
 */
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import {
  CriarProjetoRequest,
  ProjetoDetail,
  ProjetoListPage,
  ProjetoListResult,
  PublicacaoHistoryItem,
  SignedDownloadUrl,
} from '../models/proj.models';
import { mapProblemDetailToAppError } from './proj-api.mappers';

/** Base path for proj-service. Derives from ACCESS_HTTP_BASE — /v1 prefix lives in one place. */
const BASE = `${moduleBase('proj')}/projetos`;

/** Query params for listProjetos (api-contract §4.2). */
export interface ListProjetosParams {
  /** Filter by project status enum value. Optional. */
  status?: string;
  /** Items per page — 1..50, default 25 (api-contract §4.2). */
  limit?: number;
  /** Opaque keyset cursor from previous response's `nextCursor`. Never construct; only repay. */
  cursor?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjetoApiService extends AccessHttpClient {

  /**
   * GET /api/v1/proj/projetos — paginated library card list (T02, api-contract §4.2).
   *
   * Returns `ProjetoListResult` which bundles:
   *   - `page.items`      — current page of ProjetoCard[]
   *   - `page.nextCursor` — opaque cursor; `null` means last page
   *   - `degraded`        — true when `X-Degraded: true` header present (api-contract §3)
   *
   * Uses `getResponse()` (not `get()`) so the response header is accessible
   * without injecting HttpClient directly (RULE-NX-05).
   */
  listProjetos(params?: ListProjetosParams): Observable<ProjetoListResult> {
    const qs = buildQuery(params);
    return this.getResponse<ProjetoListPage>(`${BASE}${qs}`).pipe(
      map(resp => ({
        page:     resp.body ?? { items: [], nextCursor: null },
        degraded: resp.headers.get('X-Degraded') === 'true',
      })),
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/v1/proj/projetos/{id} — full project aggregate (T08 header + history).
   */
  getProjeto(id: string): Observable<ProjetoDetail> {
    return this.get<ProjetoDetail>(`${BASE}/${id}`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/v1/proj/projetos/{id}/publicacoes — publication history (T08 rows).
   */
  listPublicacoes(id: string): Observable<PublicacaoHistoryItem[]> {
    return this.get<PublicacaoHistoryItem[]>(`${BASE}/${id}/publicacoes`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/v1/proj/projetos/{id}/publicacoes/{pid}/download
   * Returns a short-TTL signed URL. D-F: open in new tab — no byte proxy.
   * 409 when epubcheckStatus is erros_criticos or pendente.
   */
  resolveDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.get<SignedDownloadUrl>(`${BASE}/${projetoId}/publicacoes/${publicacaoId}/download`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * POST /api/v1/proj/projetos/{id}/reopen — pessimistic reopen (api-contract §4.7).
   * Returns ProjetoDetail (200). 409 if project is in rascunho.
   * Idempotent: 200 with changed=false if already em_composicao.
   */
  reopenProjeto(id: string): Observable<ProjetoDetail> {
    return this.post<ProjetoDetail>(`${BASE}/${id}/reopen`, {}).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * POST /api/v1/proj/projetos — create a new project (status: rascunho).
   */
  createProjeto(req: CriarProjetoRequest): Observable<ProjetoDetail> {
    return this.post<ProjetoDetail>(BASE, req).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * DELETE /api/v1/proj/projetos/{id} — LGPD erasure (204 No Content).
   * No UI in MVP — exposed for LGPD compliance (FE-PROJ-022 / P6).
   */
  deleteProjeto(id: string): Observable<void> {
    return this.delete(`${BASE}/${id}`).pipe(
      map(() => undefined),
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function buildQuery(params?: ListProjetosParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.status)               parts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.limit != null)        parts.push(`limit=${params.limit}`);
  if (params.cursor)               parts.push(`cursor=${encodeURIComponent(params.cursor)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
