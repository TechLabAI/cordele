/**
 * projeto-http.adapter.ts — HTTP adapter stub for ProjetoPort.
 * URLs from api-contract.md §4 (base path /api/proj/projetos).
 * Activate via provideProj({ adapter: 'http' }) in production app.config.ts.
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CriarProjetoRequest,
  ProjetoCard,
  ProjetoDetail,
} from '../models/proj.models';
import { ProjetoPort } from './projeto.port';

@Injectable({ providedIn: 'root' })
export class ProjetoHttpAdapter implements ProjetoPort {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/proj/projetos';

  list(params?: { status?: string }): Observable<ProjetoCard[]> {
    const query = params?.status ? `?status=${params.status}` : '';
    return this.http.get<ProjetoCard[]>(`${this.base}${query}`);
  }

  get(projetoId: string): Observable<ProjetoDetail> {
    return this.http.get<ProjetoDetail>(`${this.base}/${projetoId}`);
  }

  create(req: CriarProjetoRequest): Observable<ProjetoDetail> {
    return this.http.post<ProjetoDetail>(this.base, req);
  }

  /**
   * POST /api/proj/projetos/{projetoId}/reopen (api-contract §4.7).
   * Empty body; returns ProjetoDetail (200). 409 if rascunho. Idempotent if already em_composicao.
   */
  reopen(projetoId: string): Observable<ProjetoDetail> {
    return this.http.post<ProjetoDetail>(`${this.base}/${projetoId}/reopen`, {});
  }

  /** DELETE /api/proj/projetos/{projetoId} — LGPD erasure (204 No Content). */
  delete(projetoId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${projetoId}`);
  }
}
