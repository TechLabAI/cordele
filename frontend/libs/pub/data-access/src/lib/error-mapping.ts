/**
 * error-mapping.ts — AppError URN → user-facing pt-BR messages (SPEC-07 / FE-PUB-011).
 *
 * The ErrorNormalize interceptor in @cordele/shared/access-http-base converts
 * RFC-7807 ProblemDetail → AppError { type, title, status, detail, traceId }.
 * The `type` URN (from api-contract §5) is the stable switch key used here.
 *
 * Critical rule (SPEC-07 §1):
 *   A successful export with epubcheckStatus=erros_criticos is NOT an HTTP error.
 *   It is domain data — the 200-body drives the red result banner. Never map it here.
 *
 * Each entry includes:
 *   - message: pt-BR user-facing string (with {traceId} placeholder for rendering)
 *   - channel: where the error is shown (banner | inline | modal | interceptor)
 *   - retryable: whether "Tentar novamente" should be offered
 */
export interface PubErrorMapping {
  message: string;
  channel: 'banner' | 'inline' | 'modal' | 'interceptor';
  retryable: boolean;
}

export const PUB_ERROR_MAP: Record<string, PubErrorMapping> = {
  'urn:cordele:pub:manuscript-missing': {
    message:
      'Este projeto ainda não tem um manuscrito importado. Importe o conteúdo (IMP) antes de exportar.',
    channel:   'banner',
    retryable: false,
  },
  'urn:cordele:pub:metadata-incomplete': {
    message:
      'Faltam metadados obrigatórios (título, autor, idioma). Complete a composição (COMP) e tente de novo.',
    channel:   'banner',
    retryable: false,
  },
  'urn:cordele:pub:artifact-not-available': {
    message:
      'Este arquivo não está disponível para download (a publicação tem erros críticos ou ainda está em processamento).',
    channel:   'inline',
    retryable: false,
  },
  'urn:cordele:pub:status-advance-failed': {
    message:
      'O ePub foi gerado, mas o status do projeto não pôde ser atualizado. O resultado foi salvo; tente novamente ou contate o suporte (traceId: {traceId}).',
    channel:   'banner',
    retryable: true,
  },
  'urn:cordele:pub:projeto-not-found': {
    message:   'Projeto não encontrado nesta empresa.',
    channel:   'banner',
    retryable: false,
  },
  'urn:cordele:pub:publicacao-not-found': {
    message:   'Publicação não encontrada nesta empresa.',
    channel:   'banner',
    retryable: false,
  },
  'urn:cordele:pub:validation': {
    message:   'Requisição inválida. Recarregue a página e tente novamente.',
    channel:   'inline',
    retryable: false,
  },
  'urn:cordele:pub:unauthorized': {
    message:   '',  // handled globally by the Access Layer — redirect to login
    channel:   'interceptor',
    retryable: false,
  },
  'urn:cordele:pub:forbidden': {
    message:   'Você não tem permissão para esta ação.',
    channel:   'modal',
    retryable: false,
  },
};

/**
 * Fallback for network errors and unrecognised 5xx responses.
 * Used when the URN is absent or unknown (SPEC-07 §2 / §4).
 */
export const PUB_FALLBACK_ERROR: PubErrorMapping = {
  message:   'Falha temporária. Tente novamente em instantes.',
  channel:   'banner',
  retryable: true,
};

/**
 * Resolve the user-facing mapping for a given AppError URN.
 * Falls back to PUB_FALLBACK_ERROR for unknown or missing URNs.
 *
 * @param urn  The `type` field from the normalized AppError.
 * @param traceId  Optional correlation id (interpolated into the message).
 */
export function resolvePubError(urn: string | undefined, traceId?: string): PubErrorMapping & { resolvedMessage: string } {
  const entry = (urn && PUB_ERROR_MAP[urn]) ? PUB_ERROR_MAP[urn] : PUB_FALLBACK_ERROR;
  const resolvedMessage = traceId
    ? entry.message.replace('{traceId}', traceId)
    : entry.message.replace(' (traceId: {traceId})', '');
  return { ...entry, resolvedMessage };
}
