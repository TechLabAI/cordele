/**
 * layout-http.adapter.ts — HTTP adapter for LayoutPort.
 * URLs from api-contract.md §4.5/§4.6/§4.7 (base: /api/comp/projetos/{projetoId}).
 * Activate via provideComp({ adapter: 'http' }) — the default for production.
 *
 * INT-FE-COMP-001 (P4): injects AccessHttpClient so that X-Empresa-Id is
 * propagated automatically on every request (observability header, not a scoping authority).
 * HttpClient is NEVER injected directly in module adapters — RULE-NX-05.
 *
 * Pattern: composition (inject AccessHttpClient) rather than inheritance.
 * Key constraint: PUT /layout body NEVER contains tipo='em-branco' (D-H / ADR-COMP-001).
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-007 — upsertLayout with UpsertLayoutBody (P2).
 * Updated: INT-FE-COMP-001 (P4) — delegates to AccessHttpClient (X-Empresa-Id propagation).
 * Moved to @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import { ConfiguracaoLayoutDto, PreviewContextDto, UpsertLayoutBody } from '../models/comp.models';
import { LayoutPort } from './layout.port';

@Injectable({ providedIn: 'root' })
export class LayoutHttpAdapter implements LayoutPort {
  private readonly http = inject(AccessHttpClient);

  /** Derives from ACCESS_HTTP_BASE via moduleBase() — /v1 prefix lives in one place. */
  private baseUrl(projetoId: string): string {
    return `${moduleBase('comp')}/projetos/${projetoId}`;
  }

  getLayout(projetoId: string): Observable<ConfiguracaoLayoutDto> {
    return this.http.get<ConfiguracaoLayoutDto>(`${this.baseUrl(projetoId)}/layout`);
  }

  /**
   * PUT /layout — body includes typography params + non-stale overrides (tipo='imagem' only).
   * Never sends tipo='em-branco' — callers must filter before invoking (D-H / ADR-COMP-001).
   */
  upsertLayout(projetoId: string, body: UpsertLayoutBody): Observable<ConfiguracaoLayoutDto> {
    return this.http.put<ConfiguracaoLayoutDto>(`${this.baseUrl(projetoId)}/layout`, body);
  }

  getPreviewContext(projetoId: string): Observable<PreviewContextDto> {
    return this.http.get<PreviewContextDto>(`${this.baseUrl(projetoId)}/preview-context`);
  }
}
