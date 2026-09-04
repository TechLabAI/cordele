/**
 * projeto-api.service.ts — standardised HTTP client for the proj-service (7 endpoints).
 * Extends AccessHttpClient so every request carries X-Empresa-Id (multi-empresa contract).
 * FE-PROJ-007 / FE-PROJ-008 (P2).
 *
 * Base path: /api/proj/projetos   (api-contract §4)
 * Mapping:   ProblemDetail → AppError via proj-api.mappers.ts
 */
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import {
  CriarProjetoRequest,
  ProjetoCard,
  ProjetoDetail,
  PublicacaoHistoryItem,
  SignedDownloadUrl,
} from '../models/proj.models';
import { mapProblemDetailToAppError } from './proj-api.mappers';

/** Base path for proj-service. Derives from ACCESS_HTTP_BASE — /v1 prefix lives in one place. */
const BASE = `${moduleBase('proj')}/projetos`;

@Injectable({ providedIn: 'root' })
export class ProjetoApiService extends AccessHttpClient {

  /**
   * GET /api/proj/projetos — library card list (T02).
   * Optional status filter (api-contract §4.1).
   */
  listProjetos(params?: { status?: string }): Observable<ProjetoCard[]> {
    const query = params?.status ? `?status=${params.status}` : '';
    return this.get<ProjetoCard[]>(`${BASE}${query}`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/proj/projetos/{id} — full project aggregate (T08 header + history).
   */
  getProjeto(id: string): Observable<ProjetoDetail> {
    return this.get<ProjetoDetail>(`${BASE}/${id}`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/proj/projetos/{id}/publicacoes — publication history (T08 rows).
   */
  listPublicacoes(id: string): Observable<PublicacaoHistoryItem[]> {
    return this.get<PublicacaoHistoryItem[]>(`${BASE}/${id}/publicacoes`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * GET /api/proj/projetos/{id}/publicacoes/{pid}/download
   * Returns a short-TTL signed URL. D-F: open in new tab — no byte proxy.
   * 409 when epubcheckStatus is erros_criticos or pendente.
   */
  resolveDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.get<SignedDownloadUrl>(`${BASE}/${projetoId}/publicacoes/${publicacaoId}/download`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * POST /api/proj/projetos/{id}/reopen — pessimistic reopen (api-contract §4.7).
   * Returns ProjetoDetail (200). 409 if project is in rascunho.
   * Idempotent: 200 with changed=false if already em_composicao.
   */
  reopenProjeto(id: string): Observable<ProjetoDetail> {
    return this.post<ProjetoDetail>(`${BASE}/${id}/reopen`, {}).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * POST /api/proj/projetos — create a new project (status: rascunho).
   */
  createProjeto(req: CriarProjetoRequest): Observable<ProjetoDetail> {
    return this.post<ProjetoDetail>(BASE, req).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }

  /**
   * DELETE /api/proj/projetos/{id} — LGPD erasure (204 No Content).
   * No UI in MVP — exposed for LGPD compliance (FE-PROJ-022 / P6).
   */
  deleteProjeto(id: string): Observable<void> {
    return this.delete(`${BASE}/${id}`).pipe(
      map(() => undefined),
      catchError((err: HttpErrorResponse) => throwError(() => mapProblemDetailToAppError(err))),
    );
  }
}
