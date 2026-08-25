/**
 * layout-mock.adapter.ts — In-memory mock for LayoutPort (dev default, 400ms delay).
 * Seed data aligned with editor-de-layout-preview prototype (LAYOUT_INICIAL).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import {
  Alinhamento,
  ConfiguracaoLayoutDto,
  LayoutOverride,
  PreviewContextDto,
  PreviewNode,
} from '../models/comp.models';
import { LayoutPort } from './layout.port';

const MOCK_DELAY = 400;

const DEFAULT_LAYOUT: ConfiguracaoLayoutDto = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 16,
  espacamentoLinha: 1.6,
  margemLateral: 48,
  h1Tamanho: 28,
  h2Tamanho: 22,
  h3Tamanho: 18,
  materialized: false,
};

const MOCK_ARVORE: PreviewNode[] = [
  {
    nodeId: 'node-001', tipo: 'capitulo', n: 1, titulo: 'O Rio',
    texto: 'A cidade acordou cedo naquela manhã de inverno. As ruas ainda molhadas da chuva da véspera refletiam as primeiras luzes do dia. Marina abriu a janela e sentiu o vento frio entrar, carregando o cheiro de terra úmida e café passado na esquina.\n\nEla olhou para o rio lá embaixo — quieto, como sempre, mas carregando em suas águas escuras toda a história que a cidade preferia esquecer.',
  },
  {
    nodeId: 'node-002', tipo: 'capitulo', n: 2, titulo: 'A Cidade',
    texto: 'Os prédios cresceram rápido demais. Onde antes havia casas baixas com quintais e mangueiras, agora se erguiam torres de vidro que não deixavam passar o vento. A cidade havia trocado sua memória por metros quadrados.',
  },
  {
    nodeId: 'node-003', tipo: 'capitulo', n: 3, titulo: 'O Retorno',
    texto: 'Ela voltou após quinze anos. Reconheceu pouca coisa. O bar da dona Conceição virou uma farmácia. A escola onde estudou foi demolida para dar lugar a um estacionamento coberto.',
  },
];

@Injectable({ providedIn: 'root' })
export class LayoutMockAdapter implements LayoutPort {
  private readonly layoutStore: Record<string, ConfiguracaoLayoutDto> = {};
  private readonly overrideStore: Record<string, LayoutOverride[]> = {};

  getLayout(projetoId: string): Observable<ConfiguracaoLayoutDto> {
    const existing = this.layoutStore[projetoId];
    return of(existing ?? { ...DEFAULT_LAYOUT, projetoId }).pipe(delay(MOCK_DELAY));
  }

  updateLayout(projetoId: string, dto: Partial<ConfiguracaoLayoutDto>): Observable<ConfiguracaoLayoutDto> {
    const current = this.layoutStore[projetoId] ?? { ...DEFAULT_LAYOUT, projetoId };
    const updated: ConfiguracaoLayoutDto = { ...current, ...dto, projetoId, materialized: true };
    this.layoutStore[projetoId] = updated;
    return of(updated).pipe(delay(MOCK_DELAY));
  }

  getPreviewContext(projetoId: string): Observable<PreviewContextDto> {
    const layout = this.layoutStore[projetoId] ?? { ...DEFAULT_LAYOUT, projetoId };
    const overrides = this.overrideStore[projetoId] ?? [];

    // Apply overrides to nodes
    const arvore = MOCK_ARVORE.map(node => {
      if (node.tipo === 'imagem') {
        const override = overrides.find(o => o.nodeId === node.nodeId);
        return { ...node, alinhamento: (override?.alinhamento ?? 'centralizado') as Alinhamento };
      }
      return node;
    });

    return of({ projetoId, arvore, layout, overrides }).pipe(delay(MOCK_DELAY));
  }
}
