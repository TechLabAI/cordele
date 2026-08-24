/**
 * manuscrito-http.adapter.ts — HTTP adapter (stub compilável; URLs from api-contract §4).
 * Activated by imp.providers.ts when adapter: 'http'.
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ContentTree,
  ManuscritoDetail,
  ManuscritoSummary,
  UploadParams,
} from '../models/imp.models';
import { ManuscritoPort } from './manuscrito.port';

const BASE = '/api/imp';

@Injectable({ providedIn: 'root' })
export class ManuscritoHttpAdapter implements ManuscritoPort {
  private readonly http = inject(HttpClient);

  create(params: UploadParams): Observable<ManuscritoDetail> {
    const form = new FormData();
    form.append('file', params.file, params.file.name);
    if (params.projetoTitulo) form.append('projetoTitulo', params.projetoTitulo);
    if (params.projetoId)     form.append('projetoId',     params.projetoId);
    // X-Empresa-Id is injected by the AuthInterceptor (access-http-base)
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
