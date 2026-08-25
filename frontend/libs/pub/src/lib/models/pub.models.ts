/**
 * pub.models.ts — Domain types for the PUB (Publicação) module.
 * Mirrors api-contract.md §6 (PublicacaoStatus §6.1, PublicacaoHistoryItem §6.2,
 * PublicationStats §6.3) and SPEC-03 view models.
 *
 * DO NOT redefine BE types — import from here in ports, adapters and facades.
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
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
