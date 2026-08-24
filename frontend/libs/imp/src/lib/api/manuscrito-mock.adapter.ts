/**
 * manuscrito-mock.adapter.ts — In-memory mock (dev default, 400ms delay).
 * Seed data from design-reference/shared/mock-data.ts (adapted to ManuscritoDetail shape).
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import {
  ContentTree,
  ManuscritoDetail,
  ManuscritoSummary,
  UploadParams,
} from '../models/imp.models';
import { ManuscritoPort } from './manuscrito.port';

const MOCK_DELAY = 1200; // simulate sync parse (longer delay = more realistic)

const MOCK_CONTENT_TREE: ContentTree = {
  schemaVersion: '1.0',
  formato: 'docx',
  chapters: [
    {
      id: 'ch-1', order: 0, title: 'Capítulo 1 — O Rio',
      blocks: [],
      sections: [
        {
          id: 'sec-1-1', order: 0, title: 'A partida',
          blocks: [
            { type: 'paragraph', id: 'p-1', order: 0, text: 'Era uma vez, no sertão...' },
          ],
        },
      ],
    },
    {
      id: 'ch-2', order: 1, title: 'Capítulo 2 — A Cidade',
      blocks: [
        {
          type: 'unparsed', id: 'u-1', order: 0,
          rawContent: '<w:tbl>...</w:tbl>',
          reason: 'complex_table',
          sourceLocation: { kind: 'docx', paragraphIndex: 34, styleName: 'TableGrid' },
        },
      ],
      sections: [],
    },
    {
      id: 'ch-3', order: 2, title: 'Capítulo 3 — O Retorno',
      blocks: [
        {
          type: 'unparsed', id: 'u-2', order: 0,
          rawContent: '<w:txbx>...</w:txbx>',
          reason: 'embedded_object',
          sourceLocation: { kind: 'docx', paragraphIndex: 67, styleName: 'TextBox' },
        },
      ],
      sections: [],
    },
    { id: 'ch-4', order: 3, title: 'Capítulo 4 — O Mercado', blocks: [], sections: [] },
    { id: 'ch-5', order: 4, title: 'Capítulo 5 — A Noite',   blocks: [], sections: [] },
  ],
};

const MOCK_MANUSCRITO: ManuscritoDetail = {
  id:                  'ms-001',
  projetoId:           'proj-001',
  nomeArquivo:         'romance-das-cidades.docx',
  formato:             'docx',
  status:              'imported',
  totalCapitulos:      18,
  totalImagens:        3,
  trechosNaoParseados: 2,
  tamanhoBytes:        8421000,
  estrutura:           MOCK_CONTENT_TREE,
  criadoEm:            '2026-08-24T14:31:46Z',
};

@Injectable({ providedIn: 'root' })
export class ManuscritoMockAdapter implements ManuscritoPort {
  private readonly store: ManuscritoDetail[] = [MOCK_MANUSCRITO];

  create(params: UploadParams): Observable<ManuscritoDetail> {
    // Validate XOR binding (mirrors api-contract §0 D-C)
    const hasTitulo = !!params.projetoTitulo?.trim();
    const hasId     = !!params.projetoId?.trim();
    if (hasTitulo === hasId) {
      return throwError(() => new Error(
        hasTitulo
          ? 'invalid-project-binding: both projetoTitulo and projetoId supplied'
          : 'invalid-project-binding: neither projetoTitulo nor projetoId supplied',
      ));
    }
    const manuscrito: ManuscritoDetail = {
      ...MOCK_MANUSCRITO,
      id:          `ms-${Date.now()}`,
      projetoId:   params.projetoId ?? `proj-${Date.now()}`,
      nomeArquivo: params.file.name,
      formato:     params.file.name.endsWith('.md') ? 'markdown' : 'docx',
      criadoEm:    new Date().toISOString(),
    };
    this.store.push(manuscrito);
    return of(manuscrito).pipe(delay(MOCK_DELAY));
  }

  get(manuscritoId: string): Observable<ManuscritoDetail> {
    const found = this.store.find(m => m.id === manuscritoId) ?? MOCK_MANUSCRITO;
    return of(found).pipe(delay(400));
  }

  getEstrutura(manuscritoId: string): Observable<ContentTree> {
    const found = this.store.find(m => m.id === manuscritoId) ?? MOCK_MANUSCRITO;
    return of(found.estrutura).pipe(delay(400));
  }

  listByProjeto(projetoId: string): Observable<ManuscritoSummary[]> {
    const result = this.store
      .filter(m => m.projetoId === projetoId)
      .map(({ estrutura: _e, ...summary }) => summary)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return of(result).pipe(delay(400));
  }
}
