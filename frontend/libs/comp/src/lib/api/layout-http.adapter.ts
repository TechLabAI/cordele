/**
 * layout-http.adapter.ts — HTTP adapter stub for LayoutPort.
 * URLs from api-contract.md §4.2/§4.4 (base path /api/comp/projetos/{projetoId}).
 * Activate via provideComp({ adapter: 'http' }) in production app.config.ts.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfiguracaoLayoutDto, PreviewContextDto } from '../models/comp.models';
import { LayoutPort } from './layout.port';

@Injectable({ providedIn: 'root' })
export class LayoutHttpAdapter implements LayoutPort {
  private readonly http = inject(HttpClient);

  private baseUrl(projetoId: string): string {
    return `/api/comp/projetos/${projetoId}`;
  }

  getLayout(projetoId: string): Observable<ConfiguracaoLayoutDto> {
    return this.http.get<ConfiguracaoLayoutDto>(`${this.baseUrl(projetoId)}/layout`);
  }

  updateLayout(projetoId: string, dto: Partial<ConfiguracaoLayoutDto>): Observable<ConfiguracaoLayoutDto> {
    return this.http.put<ConfiguracaoLayoutDto>(`${this.baseUrl(projetoId)}/layout`, dto);
  }

  getPreviewContext(projetoId: string): Observable<PreviewContextDto> {
    return this.http.get<PreviewContextDto>(`${this.baseUrl(projetoId)}/preview-context`);
  }
}
