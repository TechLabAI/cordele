/**
 * manuscrito-http.adapter.ts — HTTP adapter for the Manuscrito resource.
 * Activated by imp.providers.ts when adapter: 'http'.
 *
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 * P2: replaced HttpClient with ImpHttpClient (INT-FE-IMP-001 resolved).
 *
 * Endpoints (api-contract §4):
 *   POST   /api/v1/imp/manuscripts                          → create (sync parse, D-A)
 *   GET    /api/v1/imp/manuscripts/{id}                    → get
 *   GET    /api/v1/imp/manuscripts/{id}/estrutura          → getEstrutura
 *   GET    /api/v1/imp/projetos/{projetoId}/manuscritos    → listByProjeto
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { moduleBase } from '@cordele/shared/access-http-base';
import {
  ContentTree,
  ManuscritoDetail,
  ManuscritoSummary,
  UploadParams,
} from '../models/imp.models';
import { ManuscritoPort } from '../ports/manuscrito.port';
import { ImpHttpClient } from '../imp-http-client';

/** Base path for imp-service. Derives from ACCESS_HTTP_BASE — /v1 prefix lives in one place. */
const BASE = moduleBase('imp');

@Injectable({ providedIn: 'root' })
export class ManuscritoHttpAdapter implements ManuscritoPort {
  /** ImpHttpClient (not HttpClient) per RULE-NX-05 — empresa context from JWT `empresa_id` claim. */
  private readonly http = inject(ImpHttpClient);

  create(params: UploadParams): Observable<ManuscritoDetail> {
    const form = new FormData();
    form.append('file', params.file, params.file.name);
    if (params.projetoTitulo) form.append('projetoTitulo', params.projetoTitulo);
    if (params.projetoId)     form.append('projetoId',     params.projetoId);
    // Browser sets Content-Type: multipart/form-data + boundary (Angular detects FormData).
    // Empresa context resolved server-side from JWT `empresa_id` claim.
    return this.http.post<ManuscritoDetail>(`${BASE}/manuscripts`, form);
  }

  get(manuscritoId: string): Observable<ManuscritoDetail> {
    return this.http.get<ManuscritoDetail>(`${BASE}/manuscripts/${manuscritoId}`);
  }

  getEstrutura(manuscritoId: string): Observable<ContentTree> {
    return this.http.get<ContentTree>(`${BASE}/manuscripts/${manuscritoId}/estrutura`);
  }

  listByProjeto(projetoId: string): Observable<ManuscritoSummary[]> {
    return this.http.get<ManuscritoSummary[]>(`${BASE}/projetos/${projetoId}/manuscritos`);
  }
}
