/**
 * imp-error.mapper.ts — Centralised failure-code → UI message mapper for the IMP module.
 *
 * Authority: SPEC-07-error-handling.md §2 (failure-code table).
 * The BE returns RFC-7807 `application/problem+json`; Angular's HttpErrorResponse carries
 * the parsed body in `error.type` (the stable URN) and `error.traceId` (correlation id).
 * The `ErrorNormalize` interceptor may normalise to AppError, but adapters receive the
 * raw HttpErrorResponse — this mapper handles both shapes.
 *
 * Usage in facades:
 *   const { message } = mapImpError(err);
 *   this._error.set(message);
 *
 * FE-IMP-021 / SPEC-07 §2 §3 §4.
 */
import { HttpErrorResponse } from '@angular/common/http';

/** Display channel for the rendered error (SPEC-07 §3). */
export type ImpErrorChannel = 'inline' | 'banner' | 'modal' | 'toast';

/** Result returned by mapImpError; facades typically use only `.message`. */
export interface ImpErrorResult {
  /** Display channel — inline (drop zone/form), banner (progress card), modal, toast. */
  readonly channel: ImpErrorChannel;
  /** pt-BR user-facing message. Always present (fallback for unknown errors). */
  readonly message: string;
  /** Correlation id for support. Attached to every rendered error (SPEC-07 "attach traceId"). */
  readonly traceId?: string;
}

// ── URN constants (api-contract §5 / SPEC-07 §2) ─────────────────────────────

const URN_UNSUPPORTED_FORMAT    = 'urn:cordele:imp:unsupported-format';
const URN_FILE_TOO_LARGE        = 'urn:cordele:imp:file-too-large';
// FIX(imp-invalid-binding): api-contract uses 'invalid-binding', not 'invalid-project-binding'.
// The E2E mock and the backend both send urn:cordele:imp:invalid-binding; the previous
// 'invalid-project-binding' constant never matched, so the localized message was never shown.
const URN_INVALID_BINDING       = 'urn:cordele:imp:invalid-binding';
const URN_PROJETO_NOT_FOUND     = 'urn:cordele:imp:projeto-not-found';
const URN_PARSE_FAILED          = 'urn:cordele:imp:parse-failed';
const URN_VALIDATION            = 'urn:cordele:imp:validation';
const URN_UNAUTHORIZED          = 'urn:cordele:imp:unauthorized';
const URN_FORBIDDEN             = 'urn:cordele:imp:forbidden';
const URN_NOT_FOUND             = 'urn:cordele:imp:not-found';

/** All known IMP failure URNs (for exhaustiveness checking in tests). */
export const IMP_KNOWN_URNS = [
  URN_UNSUPPORTED_FORMAT,
  URN_FILE_TOO_LARGE,
  URN_INVALID_BINDING,
  URN_PROJETO_NOT_FOUND,
  URN_PARSE_FAILED,
  URN_VALIDATION,
  URN_UNAUTHORIZED,
  URN_FORBIDDEN,
  URN_NOT_FOUND,
] as const;

// ── URN table (SPEC-07 §2) ────────────────────────────────────────────────────

const URN_MAP: Record<string, { channel: ImpErrorChannel; message: string }> = {
  [URN_UNSUPPORTED_FORMAT]: {
    channel: 'inline',
    message: 'Formato não suportado. Envie um arquivo .docx ou .md.',
  },
  [URN_FILE_TOO_LARGE]: {
    channel: 'inline',
    message: 'Arquivo acima do limite de 50 MB. Reduza o tamanho e tente novamente.',
  },
  [URN_INVALID_BINDING]: {
    channel: 'inline',
    message:
      'Informe um nome de projeto novo OU selecione um projeto existente — nunca ambos.',
  },
  [URN_PROJETO_NOT_FOUND]: {
    channel: 'banner',
    message:
      'O projeto selecionado não foi encontrado nesta empresa. Recarregue a lista e tente de novo.',
  },
  [URN_PARSE_FAILED]: {
    channel: 'banner',
    message: 'Não foi possível ler este manuscrito (arquivo corrompido ou ilegível). Reimportar.',
  },
  [URN_VALIDATION]: {
    channel: 'inline',
    message: 'Requisição inválida. Verifique o arquivo e os campos e tente novamente.',
  },
  // 401 is handled globally by the Access Layer — IMP does not map it (SPEC-07 §2).
  [URN_UNAUTHORIZED]: {
    channel: 'banner',
    message: 'Sessão expirada. Faça login novamente.',
  },
  [URN_FORBIDDEN]: {
    channel: 'modal',
    message: 'Você não tem permissão para esta ação.',
  },
  [URN_NOT_FOUND]: {
    channel: 'banner',
    message: 'Manuscrito não encontrado nesta empresa.',
  },
};

// ── HTTP-status fallbacks (SPEC-07 §2 — for errors without a typed URN) ───────

const STATUS_MAP: Array<[(s: number) => boolean, { channel: ImpErrorChannel; message: string }]> =
  [
    // 401 — global interceptor handles; defensive banner here in case interceptor is bypassed
    [(s) => s === 401, { channel: 'banner', message: 'Sessão expirada. Faça login novamente.' }],
    // 403
    [(s) => s === 403, { channel: 'modal', message: 'Você não tem permissão para esta ação.' }],
    // 404
    [(s) => s === 404, { channel: 'banner', message: 'Manuscrito não encontrado nesta empresa.' }],
    // 413
    [
      (s) => s === 413,
      { channel: 'inline', message: 'Arquivo acima do limite de 50 MB. Reduza o tamanho e tente novamente.' },
    ],
    // 415
    [
      (s) => s === 415,
      { channel: 'inline', message: 'Formato não suportado. Envie um arquivo .docx ou .md.' },
    ],
    // 400/422 generic (URN not present)
    [
      (s) => s === 400 || s === 422,
      { channel: 'inline', message: 'Requisição inválida. Verifique o arquivo e os campos e tente novamente.' },
    ],
    // 504 / timeout
    [
      (s) => s === 504 || s === 0,
      { channel: 'banner', message: 'A análise demorou demais. Tente reimportar.' },
    ],
    // 5xx generic (network / server error) — SPEC-07 §2 "network / 5xx"
    [
      (s) => s >= 500 && s < 600,
      { channel: 'banner', message: 'Falha temporária. Tente novamente em instantes.' },
    ],
  ];

// ── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK: { channel: ImpErrorChannel; message: string } = {
  channel: 'banner',
  message: 'Falha temporária. Tente novamente em instantes.',
};

// ── traceId extraction ────────────────────────────────────────────────────────

function extractTraceId(err: HttpErrorResponse): string | undefined {
  // RFC-7807 body may carry `traceId` directly
  const bodyTrace = (err.error as { traceId?: string } | null)?.traceId;
  if (bodyTrace) return bodyTrace;
  // Fallback: X-Correlation-Id header (added by access-http-base interceptor)
  const headerTrace = err.headers?.get('X-Correlation-Id');
  return headerTrace ?? undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * mapImpError — maps an HttpErrorResponse to a user-facing channel + message (pt-BR).
 *
 * Priority: RFC-7807 `type` URN → HTTP status fallback → generic fallback.
 * Always includes `traceId` when the response carries a correlation id (SPEC-07 §4).
 *
 * @param err - Angular HttpErrorResponse from the HTTP layer.
 * @returns ImpErrorResult with channel, message, and optional traceId.
 */
export function mapImpError(err: HttpErrorResponse): ImpErrorResult {
  const traceId = extractTraceId(err);

  // 1. Try URN-based mapping (most specific)
  const urn = (err.error as { type?: string } | null)?.type;
  if (urn && URN_MAP[urn]) {
    return { ...URN_MAP[urn], traceId };
  }

  // 2. HTTP status fallback
  for (const [predicate, result] of STATUS_MAP) {
    if (predicate(err.status)) {
      return { ...result, traceId };
    }
  }

  // 3. Generic fallback ("network / 5xx" SPEC-07 §2)
  return { ...FALLBACK, traceId };
}
