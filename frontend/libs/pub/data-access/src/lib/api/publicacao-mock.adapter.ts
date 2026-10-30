/**
 * publicacao-mock.adapter.ts — In-memory mock for PublicacaoPort (dev/test only).
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-009).
 *
 * Seed data aligned with design-reference/shared/mock-data.ts (publicacao / publicacoes arrays).
 * Simulates the bounded-poll flow: triggerExport returns gerando; after 2 pollStatus calls returns publicado.
 *
 * isMock: true — do NOT use as default adapter in production (app.config.ts must use adapter='http').
 */
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  PublicacaoHistoryItem,
  PublicacaoStatus,
  PublicationStats,
  SignedDownloadUrl,
} from '../models/pub.models';
import { PublicacaoPort } from './publicacao.port';

const MOCK_DELAY = 400;

// ─── Seed data (aligned with prototype shared/mock-data.ts) ──────────────────

const MOCK_STATUS_PUBLICADO: PublicacaoStatus = {
  publicacaoId: 'pub-001',
  projetoId:    'proj-001',
  status:       'publicado',
  epubcheckStatus: 'avisos',
  sequencia:    2,
  totalErros:   0,
  totalAvisos:  2,
  resumoErro:   null,
  arquivoDisponivel: true,
  iniciadaEm:   '2026-06-19T16:28:00Z',
  concluidaEm:  '2026-06-19T16:30:00Z',
};

const MOCK_STATUS_GERANDO: PublicacaoStatus = {
  ...MOCK_STATUS_PUBLICADO,
  status:           'gerando',
  epubcheckStatus:  'pendente',
  sequencia:        3,
  publicacaoId:     'pub-new',
  arquivoDisponivel: false,
  concluidaEm:      null,
};

const MOCK_HISTORY: PublicacaoHistoryItem[] = [
  {
    publicacaoId:    'pub-001',
    projetoId:       'proj-001',
    epubcheckStatus: 'avisos',
    totalErros:      0,
    totalAvisos:     2,
    erros:           null,
    arquivoUrl:      '/exports/romance-das-cidades-v2.epub',
    criadoEm:        '2026-06-19T16:30:00Z',
  },
  {
    publicacaoId:    'pub-000',
    projetoId:       'proj-001',
    epubcheckStatus: 'erros_criticos',
    totalErros:      3,
    totalAvisos:     0,
    erros:           'OPS-001: spine item não encontrado (capítulo 17); META-001: identifier ausente; CSS-001: propriedade border-collapse não suportada em ePub 3',
    arquivoUrl:      null,
    criadoEm:        '2026-06-14T09:15:00Z',
  },
];

const MOCK_STATS: PublicationStats = {
  total:        2,
  publicadas:   1,
  comAvisos:    1,
  comErros:     1,
  emAndamento:  0,
  latestOutcome: 'avisos',
};

@Injectable({ providedIn: 'root' })
export class PublicacaoMockAdapter implements PublicacaoPort {
  /** isMock: true — for testing only; do NOT use in production. */
  readonly isMock = true;

  /** Tracks poll calls per publicacaoId to simulate progression gerando → publicado. */
  private readonly pollCount: Record<string, number> = {};

  triggerExport(projetoId: string): Observable<PublicacaoStatus> {
    // Reset poll counter for new build
    this.pollCount[MOCK_STATUS_GERANDO.publicacaoId] = 0;
    return of({ ...MOCK_STATUS_GERANDO, projetoId }).pipe(delay(MOCK_DELAY));
  }

  pollStatus(projetoId: string, publicacaoId: string): Observable<PublicacaoStatus> {
    const count = (this.pollCount[publicacaoId] ?? 0) + 1;
    this.pollCount[publicacaoId] = count;
    // Simulate: 2 non-terminal polls then resolve to publicado
    if (count < 3) {
      const inFlight: PublicacaoStatus = {
        ...MOCK_STATUS_GERANDO,
        projetoId,
        publicacaoId,
        status: count === 1 ? 'gerando' : 'validando',
      };
      return of(inFlight).pipe(delay(MOCK_DELAY));
    }
    return of({ ...MOCK_STATUS_PUBLICADO, projetoId, publicacaoId }).pipe(delay(MOCK_DELAY));
  }

  list(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    const result = MOCK_HISTORY
      .filter(p => p.projetoId === projetoId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return of(result).pipe(delay(MOCK_DELAY));
  }

  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    const row = MOCK_HISTORY.find(
      p => p.projetoId === projetoId && p.publicacaoId === publicacaoId,
    );
    if (!row?.arquivoUrl) {
      return throwError(() => ({
        status: 409,
        type:   'urn:cordele:pub:artifact-not-available',
        message: 'Artefato não disponível para download',
      }));
    }
    const signed: SignedDownloadUrl = {
      publicacaoId,
      arquivoUrl: `${row.arquivoUrl}?sig=mock-sig&expires=3600`,
      expiresAt:  new Date(Date.now() + 3600_000).toISOString(),
    };
    return of(signed).pipe(delay(MOCK_DELAY));
  }

  getStats(_projetoId: string): Observable<PublicationStats> {
    return of({ ...MOCK_STATS }).pipe(delay(MOCK_DELAY));
  }
}
