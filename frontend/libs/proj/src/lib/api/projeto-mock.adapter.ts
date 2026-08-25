/**
 * projeto-mock.adapter.ts — In-memory mock for ProjetoPort (dev default, 400ms delay).
 * Seed data aligned with design-reference/shared/mock-data.ts (projetos array).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  CriarProjetoRequest,
  ProjetoCard,
  ProjetoDetail,
} from '../models/proj.models';
import { ProjetoPort } from './projeto.port';

const MOCK_DELAY = 400;

const MOCK_CARDS: ProjetoCard[] = [
  {
    id:                    'proj-001',
    nome:                  'Romance das Cidades',
    autor:                 'Eliana Moraes',
    status:                'publicado',
    totalCapitulos:        18,
    totalImagens:          3,
    ultimoEpubcheckStatus: 'avisos',
    ultimaAtividadeEm:     '2026-06-19T16:30:00Z',
    criadoEm:              '2026-06-01T09:00:00Z',
  },
  {
    id:                    'proj-002',
    nome:                  'Poemas do Sertão',
    autor:                 null,
    status:                'em_composicao',
    totalCapitulos:        0,
    totalImagens:          0,
    ultimoEpubcheckStatus: null,
    ultimaAtividadeEm:     '2026-06-14T09:15:00Z',
    criadoEm:              '2026-06-10T11:00:00Z',
  },
  {
    id:                    'proj-003',
    nome:                  'Contos Urbanos',
    autor:                 null,
    status:                'rascunho',
    totalCapitulos:        0,
    totalImagens:          0,
    ultimoEpubcheckStatus: null,
    ultimaAtividadeEm:     '2026-06-18T14:05:00Z',
    criadoEm:              '2026-06-18T14:00:00Z',
  },
];

const MOCK_DETAIL: ProjetoDetail = {
  id:          'proj-001',
  editoraId:   'editora-001',
  nome:        'Romance das Cidades',
  descricao:   null,
  status:      'publicado',
  criadoEm:    '2026-06-01T09:00:00Z',
  atualizadoEm:'2026-06-19T16:30:00Z',
  manuscriptSummary: {
    manuscritoId:         'ms-001',
    nomeArquivo:          'romance-das-cidades.docx',
    formato:              'docx',
    totalCapitulos:       18,
    totalImagens:         3,
    trechosNaoParseados:  2,
    criadoEm:             '2026-06-01T09:05:00Z',
  },
  metadata:           { autor: 'Eliana Moraes' },
  publicationHistory: [],
  degraded:           false,
};

@Injectable({ providedIn: 'root' })
export class ProjetoMockAdapter implements ProjetoPort {
  private readonly cards: ProjetoCard[] = [...MOCK_CARDS];

  list(params?: { status?: string }): Observable<ProjetoCard[]> {
    const result = params?.status
      ? this.cards.filter(c => c.status === params.status)
      : [...this.cards].sort(
          (a, b) => b.ultimaAtividadeEm.localeCompare(a.ultimaAtividadeEm),
        );
    return of(result).pipe(delay(MOCK_DELAY));
  }

  get(projetoId: string): Observable<ProjetoDetail> {
    const card = this.cards.find(c => c.id === projetoId);
    if (!card) {
      return throwError(() => ({ status: 404, message: 'Projeto não encontrado' }));
    }
    const detail: ProjetoDetail = {
      ...MOCK_DETAIL,
      id:     card.id,
      nome:   card.nome,
      status: card.status,
      metadata: card.autor ? { autor: card.autor } : null,
      degraded: false,
    };
    return of(detail).pipe(delay(MOCK_DELAY));
  }

  create(req: CriarProjetoRequest): Observable<ProjetoDetail> {
    const id = `proj-${Date.now()}`;
    const now = new Date().toISOString();
    const card: ProjetoCard = {
      id,
      nome:                  req.nome,
      autor:                 null,
      status:                'rascunho',
      totalCapitulos:        0,
      totalImagens:          0,
      ultimoEpubcheckStatus: null,
      ultimaAtividadeEm:     now,
      criadoEm:              now,
    };
    this.cards.unshift(card);
    const detail: ProjetoDetail = {
      id,
      editoraId:          'editora-001',
      nome:               req.nome,
      descricao:          req.descricao ?? null,
      status:             'rascunho',
      criadoEm:           now,
      atualizadoEm:       now,
      manuscriptSummary:  null,
      metadata:           null,
      publicationHistory: [],
      degraded:           false,
    };
    return of(detail).pipe(delay(MOCK_DELAY));
  }

  reopen(projetoId: string): Observable<ProjetoDetail> {
    const card = this.cards.find(c => c.id === projetoId);
    if (!card) {
      return throwError(() => ({ status: 404, message: 'Projeto não encontrado' }));
    }
    if (card.status === 'rascunho') {
      return throwError(() => ({
        status: 409,
        type: 'urn:cordele:proj:illegal-status-transition',
        message: 'Projeto em rascunho não pode ser reaberto',
      }));
    }
    // idempotent: already em_composicao → return current state, changed=false
    if (card.status !== 'em_composicao') {
      card.status = 'em_composicao';
      card.ultimaAtividadeEm = new Date().toISOString();
    }
    return this.get(projetoId).pipe(delay(MOCK_DELAY));
  }

  delete(projetoId: string): Observable<void> {
    const idx = this.cards.findIndex(c => c.id === projetoId);
    if (idx === -1) {
      return throwError(() => ({ status: 404, message: 'Projeto não encontrado' }));
    }
    this.cards.splice(idx, 1);
    return of(undefined).pipe(delay(MOCK_DELAY));
  }
}
