/**
 * pub.models.ts — Domain types for the PUB (Publicação) module.
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-007).
 * Mirrors api-contract.md §6 (PublicacaoStatus §6.1, PublicacaoHistoryItem §6.2,
 * PublicationStats §6.3, ValidationMessageItem §6.5) and SPEC-03 view models.
 *
 * INT-FE-PUB-004 (2026-09-03): ValidationMessageItem + AvisoVM + toAvisoVM added
 * after PUB-016 BE landed (endpoint §4.6 ratified; 10/10 items DONE, score 93).
 *
 * DO NOT redefine BE types — import from @cordele/pub-data-access in ports, adapters and facades.
 */

/** Build lifecycle state machine (api-contract D-Q). */
export type BuildStatus = 'gerando' | 'validando' | 'publicado' | 'com_erros';

/** Epubcheck verdict (api-contract D-Q). */
export type EpubcheckStatus = 'valido' | 'avisos' | 'erros_criticos' | 'pendente';

/** UI phase for T07 (derived from BuildStatus + EpubcheckStatus per SPEC-03 phase mapping). */
export type ExportPhase = 'gerando' | 'valido' | 'erros' | 'error';

// ─── §6.1 — PublicacaoStatus (trigger + poll — T07) ──────────────────────────

/** Response shape for POST trigger (202) and GET status poll (200). api-contract §6.1. */
export interface PublicacaoStatus {
  publicacaoId: string;
  projetoId: string;
  status: BuildStatus;
  epubcheckStatus: EpubcheckStatus;
  sequencia: number;
  totalErros: number;
  totalAvisos: number;
  resumoErro: string | null;
  arquivoDisponivel: boolean;
  iniciadaEm: string;          // ISO UTC
  concluidaEm: string | null;  // ISO UTC; null while non-terminal
  /**
   * ADR-004: ePub KPI fields — non-null only when status = 'publicado'.
   * null for in-flight builds or builds with errors.
   * totalPaginas intentionally absent: ePub reflowable has no fixed pagination (ADR-004 §D-S).
   */
  tamanhoBytes:   number | null;
  totalCapitulos: number | null;
  totalImagens:   number | null;
}

// ─── §3 — EpubSummaryVM (KPI view model — T07 / INT-FE-PUB-005) ──────────────

/**
 * View model for ePub KPI tiles shown in T07 after a successful export (SPEC-03 §3).
 * Produced by ExportFacade.summary when status = 'publicado'; null otherwise.
 *
 * paginas is PERMANENTLY null — ADR-004: ePub reflowable has no fixed pagination;
 * this is a product decision, not a data gap.
 */
export interface EpubSummaryVM {
  /** Formatted size string (e.g. '1.4 MB'), or null when tamanhoBytes is null. */
  tamanho:   string | null;
  /** Always null — ADR-004. Do NOT display a tile for this field. */
  paginas:   null;
  /** Number of chapters, or null when not yet available. */
  capitulos: number | null;
  /** Number of images, or null when not yet available. */
  imagens:   number | null;
}

/**
 * Formats a byte count to a human-readable string.
 * Used to populate EpubSummaryVM.tamanho from PublicacaoStatus.tamanhoBytes.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ─── §6.2 — PublicacaoHistoryItem (T08 history list) ─────────────────────────

/** One row in the T08 history list. api-contract §6.2. */
export interface PublicacaoHistoryItem {
  publicacaoId: string;
  projetoId: string;
  epubcheckStatus: EpubcheckStatus;
  totalErros: number;
  totalAvisos: number;
  erros: string | null;
  arquivoUrl: string | null;   // null for erros_criticos / pendente
  criadoEm: string;            // ISO UTC
}

// ─── §6.3 — PublicationStats (KPI — T07/T08) ─────────────────────────────────

/** Live KPI projection. api-contract §6.3 / D-O. */
export interface PublicationStats {
  total: number;
  publicadas: number;
  comAvisos: number;
  comErros: number;
  emAndamento: number;
  latestOutcome: EpubcheckStatus | null;
}

// ─── Signed download URL (§4.4) ───────────────────────────────────────────────

/** Short-TTL signed URL minted by PUB (D-F); browser opens directly, SPA never proxies bytes. */
export interface SignedDownloadUrl {
  publicacaoId: string;
  arquivoUrl: string;
  expiresAt: string;  // ISO UTC
}

// ─── §6.5 — ValidationMessageItem (detail list — INT-FE-PUB-004 / PUB-016) ───

/** Severity level for a single epubcheck validation message (api-contract §6.5). */
export type ValidationMessageSeverity = 'error' | 'warning' | 'info';

/**
 * One epubcheck report line returned by
 * GET /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/validation-messages (§4.6).
 * Ordered by `ordem ASC` — 0-based insertion order from the epubcheck run.
 *
 * `location` is nullable: not every epubcheck message includes a file/line reference.
 */
export interface ValidationMessageItem {
  id: string;                           // UUID v4
  severity: ValidationMessageSeverity;  // 'error' | 'warning' | 'info'
  code: string;                         // epubcheck message id (e.g. PKG-006, OPF-033)
  message: string;                      // human-readable epubcheck message text
  location: string | null;              // nullable — file/line reference may be absent
  ordem: number;                        // 0-based; list is returned ordered by this ASC
}

/**
 * FE view model for one validation message row (SPEC-03 §5).
 * Produced by `toAvisoVM(item)` from a `ValidationMessageItem`.
 *
 * `local` mirrors `location` (nullable); rendered as em-dash when null (never "null").
 */
export interface AvisoVM {
  code: string;
  msg: string;
  local: string | null;
  severity: ValidationMessageSeverity;
}

/**
 * Maps a BE `ValidationMessageItem` (api-contract §6.5) to the FE `AvisoVM` view model.
 * Preserves `location: null` as `local: null` — the UI renders it as "—" (em-dash).
 */
export function toAvisoVM(item: ValidationMessageItem): AvisoVM {
  return {
    code:     item.code,
    msg:      item.message,
    local:    item.location,
    severity: item.severity,
  };
}

// ─── Cross-context types (INT-FE-PUB-002/003, P4) ────────────────────────────

/**
 * Minimal project header info consumed by PUB's HistoryFacade (INT-FE-PUB-002).
 * Resolved via cross-context call to proj-service (GET /api/v1/proj/projetos/{id}).
 * Defined here (scope:pub type:domain) to avoid boundary violation from pub-data-access
 * importing scope:proj models directly.
 * Real wiring: app.config.ts provides an injection token that maps to ProjetoApiService.
 */
export interface ProjetoHeaderInfo {
  nome: string;
  status: string;     // ProjetoStatus enum value (rascunho | em_composicao | publicado | com_erros)
  editoraId: string;
}
