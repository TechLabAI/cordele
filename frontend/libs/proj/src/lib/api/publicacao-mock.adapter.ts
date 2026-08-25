/**
 * publicacao-mock.adapter.ts — In-memory mock for PublicacaoPort (dev default, 400ms delay).
 * Seed data aligned with design-reference/shared/mock-data.ts (publicacoes array).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { PublicacaoHistoryItem, SignedDownloadUrl } from '../models/proj.models';
import { PublicacaoPort } from './publicacao.port';

const MOCK_DELAY = 400;

const MOCK_PUBLICACOES: PublicacaoHistoryItem[] = [
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

@Injectable({ providedIn: 'root' })
export class PublicacaoMockAdapter implements PublicacaoPort {
  list(projetoId: string): Observable<PublicacaoHistoryItem[]> {
    const result = MOCK_PUBLICACOES
      .filter(p => p.projetoId === projetoId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return of(result).pipe(delay(MOCK_DELAY));
  }

  getDownloadUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    const pub = MOCK_PUBLICACOES.find(
      p => p.projetoId === projetoId && p.publicacaoId === publicacaoId,
    );
    if (!pub) {
      return throwError(() => ({ status: 404, message: 'Publicação não encontrada' }));
    }
    if (!pub.arquivoUrl) {
      return throwError(() => ({
        status: 409,
        type: 'urn:cordele:proj:artifact-not-available',
        message: 'Artefato não disponível para download',
      }));
    }
    // In mock, return a stub signed URL (D-F: SPA opens this directly, never proxies bytes)
    const signed: SignedDownloadUrl = {
      publicacaoId,
      arquivoUrl:  `${pub.arquivoUrl}?sig=mock-token-${Date.now()}&expires=1800`,
      expiresAt:   new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    return of(signed).pipe(delay(MOCK_DELAY));
  }
}
