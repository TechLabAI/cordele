/**
 * proj-api.mappers.ts — mappers between raw API responses and domain models.
 * FE-PROJ-008 (P2).
 *
 * - mapProblemDetailToAppError: RFC 7807 ProblemDetail → AppError
 * - mapProjetoCard: raw unknown → ProjetoCard (basic pass-through with type guard)
 * - mapProjetoDetail: raw unknown → ProjetoDetail (basic pass-through with type guard)
 *
 * Note: the backend already returns camelCase JSON matching the domain types,
 * so the structural mappers primarily enforce the type boundary and provide
 * a consistent hook for future field renaming without touching the facades.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { ProjetoCard, ProjetoDetail } from '../models/proj.models';

/**
 * Local AppError shape (mirrors @cordele/shared/error-model).
 * Defined locally because proj is a buildable lib and error-model is non-buildable
 * (@nx/enforce-module-boundaries). See comp/comp-error.mapper.ts for the same pattern.
 */
export interface ProjApiError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly correlationId?: string;
}

// ── ProblemDetail shape (RFC 7807 + Cordelê extensions) ──────────────────────

interface ProblemDetail {
  type?: string;        // urn:problem:*
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
}

// ── ProblemDetail → AppError ──────────────────────────────────────────────────

/**
 * Converts an HttpErrorResponse whose body follows RFC 7807 ProblemDetail
 * into a normalised ProjApiError (mirrors AppError from @cordele/shared/error-model).
 *
 * Falls back gracefully when the body is not a ProblemDetail (plain string, null, etc.).
 */
export function mapProblemDetailToAppError(err: HttpErrorResponse): ProjApiError {
  const body: ProblemDetail | null =
    err.error && typeof err.error === 'object' ? (err.error as ProblemDetail) : null;

  const code = body?.type ?? `HTTP_${err.status}`;
  const message: string =
    body?.detail ??
    body?.title ??
    err.message ??
    `Erro HTTP ${err.status}`;

  const result: ProjApiError = {
    code,
    message,
    httpStatus:    err.status,
    title:         body?.title,
    detail:        body?.detail,
    correlationId: body?.correlationId,
  };
  return result;
}

// ── ProjetoCard mapper ────────────────────────────────────────────────────────

/**
 * Maps a raw API response to a ProjetoCard.
 * The backend already returns camelCase JSON; this mapper enforces the type
 * boundary and strips unknown fields.
 */
export function mapProjetoCard(raw: unknown): ProjetoCard {
  const r = raw as Record<string, unknown>;
  return {
    id:                     String(r['id'] ?? ''),
    nome:                   String(r['nome'] ?? ''),
    autor:                  r['autor'] != null ? String(r['autor']) : null,
    status:                 r['status'] as ProjetoCard['status'],
    totalCapitulos:         Number(r['totalCapitulos'] ?? 0),
    totalImagens:           Number(r['totalImagens'] ?? 0),
    ultimoEpubcheckStatus:  r['ultimoEpubcheckStatus'] != null
                              ? r['ultimoEpubcheckStatus'] as ProjetoCard['ultimoEpubcheckStatus']
                              : null,
    ultimaAtividadeEm:      String(r['ultimaAtividadeEm'] ?? ''),
    criadoEm:               String(r['criadoEm'] ?? ''),
  };
}

// ── ProjetoDetail mapper ──────────────────────────────────────────────────────

/**
 * Maps a raw API response to a ProjetoDetail.
 * Nested objects (manuscriptSummary, metadata, publicationHistory) are shallow-mapped.
 */
export function mapProjetoDetail(raw: unknown): ProjetoDetail {
  const r = raw as Record<string, unknown>;
  return {
    id:                 String(r['id'] ?? ''),
    editoraId:          String(r['editoraId'] ?? ''),
    nome:               String(r['nome'] ?? ''),
    descricao:          r['descricao'] != null ? String(r['descricao']) : null,
    status:             r['status'] as ProjetoDetail['status'],
    criadoEm:           String(r['criadoEm'] ?? ''),
    atualizadoEm:       String(r['atualizadoEm'] ?? ''),
    manuscriptSummary:  r['manuscriptSummary'] as ProjetoDetail['manuscriptSummary'] ?? null,
    metadata:           r['metadata'] as ProjetoDetail['metadata'] ?? null,
    publicationHistory: Array.isArray(r['publicationHistory'])
                          ? r['publicationHistory'] as ProjetoDetail['publicationHistory']
                          : [],
    degraded:           Boolean(r['degraded'] ?? false),
  };
}
