/**
 * proj.models.ts — domain types for the PROJ module.
 * Reconciled with api-contract.md §6 (ProjetoCard, ProjetoDetail, PublicacaoHistoryItem)
 * and SPEC-03 view-models (LibraryVM, HistoryVM, StatusBadgeVM).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */

// ── Status enums ──────────────────────────────────────────────────────────────

export type ProjetoStatus = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';
export type EpubcheckStatus = 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
export type BadgeTone = 'draft' | 'progress' | 'valid' | 'warn' | 'error' | 'pending';

// ── API shapes (api-contract §6) ──────────────────────────────────────────────

/** api-contract §6.2 — library card (GET /api/proj/projetos) */
export interface ProjetoCard {
  id: string;
  nome: string;
  autor: string | null;
  status: ProjetoStatus;
  totalCapitulos: number;
  totalImagens: number;
  ultimoEpubcheckStatus: EpubcheckStatus | null;
  ultimaAtividadeEm: string;
  criadoEm: string;
}

/** api-contract §6.3 — one publication row (GET .../publicacoes) */
export interface PublicacaoHistoryItem {
  publicacaoId: string;
  projetoId: string;
  epubcheckStatus: EpubcheckStatus;
  totalErros: number;
  totalAvisos: number;
  erros: string | null;
  arquivoUrl: string | null;
  criadoEm: string;
}

/** api-contract §6.1 — full project aggregate (GET /api/proj/projetos/{id} + reopen response) */
export interface ProjetoDetail {
  id: string;
  editoraId: string;
  nome: string;
  descricao: string | null;
  status: ProjetoStatus;
  criadoEm: string;
  atualizadoEm: string;
  manuscriptSummary: ManuscriptSummary | null;
  metadata: { autor: string | null } | null;
  publicationHistory: PublicacaoHistoryItem[];
  degraded: boolean;
}

export interface ManuscriptSummary {
  manuscritoId: string | null;
  nomeArquivo: string;
  formato: string;
  totalCapitulos: number;
  totalImagens: number;
  trechosNaoParseados: number;
  criadoEm: string;
}

/** api-contract §4.5 — signed URL response */
export interface SignedDownloadUrl {
  publicacaoId: string;
  arquivoUrl: string;
  expiresAt: string;
}

/** api-contract §4.1 — project creation request */
export interface CriarProjetoRequest {
  nome: string;
  descricao?: string;
}

// ── View-model types (SPEC-03) ────────────────────────────────────────────────

export interface StatusBadgeVM {
  tone: BadgeTone;
  label: string;
  icon: string;
}

export interface ProjetoCardVM extends ProjetoCard {
  badge: StatusBadgeVM;
  canQuickDownload: boolean;
  openTarget: 'imp' | 'comp' | 'history';
}

/** Derives a StatusBadgeVM from api-contract §6.2 badge-derivation rule (SPEC-03 §3). */
export function deriveBadge(
  status: ProjetoStatus,
  ultimoEpubcheckStatus: EpubcheckStatus | null,
): StatusBadgeVM {
  if (status === 'rascunho') {
    return { tone: 'draft',    label: 'Rascunho',      icon: 'edit_note' };
  }
  if (status === 'em_composicao') {
    return { tone: 'progress', label: 'Em andamento',  icon: 'pending' };
  }
  // publication exists — fold epubcheck status
  switch (ultimoEpubcheckStatus) {
    case 'valido':         return { tone: 'valid',   label: 'Válido',    icon: 'check_circle' };
    case 'avisos':         return { tone: 'warn',    label: 'Avisos',    icon: 'check_circle' };
    case 'erros_criticos': return { tone: 'error',   label: 'Erros',     icon: 'cancel' };
    default:               return { tone: 'pending', label: 'Pendente',  icon: 'hourglass_empty' };
  }
}

/** Derives openTarget from project status (SPEC-03 §1 — no dead ends). */
export function deriveOpenTarget(status: ProjetoStatus): 'imp' | 'comp' | 'history' {
  if (status === 'rascunho')      return 'imp';
  if (status === 'em_composicao') return 'comp';
  return 'history';
}
