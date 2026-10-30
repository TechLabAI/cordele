/**
 * manuscrito-http.adapter.ts — HTTP adapter for the Manuscrito resource.
 * Activated by imp.providers.ts when adapter: 'http'.
 *
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 * P2: replaced HttpClient with ImpHttpClient (INT-FE-IMP-001 resolved).
 *
 * Endpoints (api-contract §4):
 *   POST   /api/imp/manuscripts                          → create (sync parse, D-A)
 *   GET    /api/imp/manuscripts/{id}                    → get
 *   GET    /api/imp/manuscripts/{id}/estrutura          → getEstrutura
 *   GET    /api/imp/projetos/{projetoId}/manuscritos    → listByProjeto
 */
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContentTree,
  ManuscritoDetail,
  ManuscritoSummary,
  UploadParams,
} from '../models/imp.models';
import { ManuscritoPort } from '../ports/manuscrito.port';
import { ImpHttpClient } from '../imp-http-client';

const BASE = '/api/imp';

@Injectable({ providedIn: 'root' })
export class ManuscritoHttpAdapter implements ManuscritoPort {
  /** ImpHttpClient (not HttpClient) — X-Empresa-Id header added automatically. */
  private readonly http = inject(ImpHttpClient);

  create(params: UploadParams): Observable<ManuscritoDetail> {
    const form = new FormData();
    form.append('file', params.file, params.file.name);
    if (params.projetoTitulo) form.append('projetoTitulo', params.projetoTitulo);
    if (params.projetoId)     form.append('projetoId',     params.projetoId);
    // X-Empresa-Id is injected by ImpHttpClient → AccessHttpClient automatically.
    // Browser sets Content-Type: multipart/form-data + boundary (Angular detects FormData).
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
