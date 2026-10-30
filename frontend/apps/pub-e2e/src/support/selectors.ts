/**
 * selectors.ts — stable Playwright selectors for PUB E2E tests.
 * Uses data-testid attributes added in P9 hardening pass.
 *
 * FE-PUB-027 / FE-PUB-028 (P9 E2E).
 */

// ── T07 — Exportação e Validação ──────────────────────────────────────────────

export const T07 = {
  /** Spinner shown while the ePub is being generated (indeterminate). */
  estadoGerando:  '[data-testid="pub-estado-gerando"]',
  /** Banner shown when epubcheckStatus = valido | avisos. */
  bannerValido:   '[data-testid="banner-valido"]',
  /** Banner shown when epubcheckStatus = erros_criticos. */
  bannerErros:    '[data-testid="banner-erros"]',
  /** Error state container (network/timeout errors). */
  estadoError:    '[data-testid="pub-estado-error"]',
  /** "Baixar ePub" button (enabled when podeBaixar = true). */
  btnBaixar:      '[data-testid="btn-baixar"]',
  /** "Tentar novamente" button shown in the error state. */
  btnRetry:       '[data-testid="btn-retry"]',
  /** Correlation trace id displayed in error states. */
  errorTraceId:   '[data-testid="error-trace-id"]',
  /** Progress bar (aria-role). */
  progressbar:    '[role="progressbar"]',
};

// ── T08 — Download e Histórico ────────────────────────────────────────────────

export const T08 = {
  /** Loading spinner. */
  loading:        '[role="progressbar"]',
  /** Refetch notice banner (signed URL expired — re-fetching). */
  refetchNotice:  '[data-testid="refetch-notice"]',
  /** Inline download error banner. */
  downloadError:  '[data-testid="download-error"]',
  /** Trace id inside the download error banner. */
  downloadTraceId:'[data-testid="download-trace-id"]',
  /** Download button for a specific publicacao id. */
  btnBaixar: (pubId: string) => `[data-testid="btn-baixar-${pubId}"]`,
  /** Row container for a specific publicacao id. */
  row: (pubId: string) => `[data-testid="pub-row-${pubId}"]`,
  /** "inválido" label in a row. */
  labelInvalido: (pubId: string) => `[data-testid="label-invalido-${pubId}"]`,
};
