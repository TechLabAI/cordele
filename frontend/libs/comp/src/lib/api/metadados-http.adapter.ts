/**
 * metadados-http.adapter.ts — HTTP adapter stub for MetadadosPort.
 * URLs from api-contract.md §4.1/§4.3 (base path /api/comp/projetos/{projetoId}).
 * Activate via provideComp({ adapter: 'http' }) in production app.config.ts.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CapaUploadResponse, MetadadosDto } from '../models/comp.models';
import { MetadadosPort } from './metadados.port';

@Injectable({ providedIn: 'root' })
export class MetadadosHttpAdapter implements MetadadosPort {
  private readonly http = inject(HttpClient);

  private baseUrl(projetoId: string): string {
    return `/api/comp/projetos/${projetoId}`;
  }

  get(projetoId: string): Observable<MetadadosDto> {
    return this.http.get<MetadadosDto>(`${this.baseUrl(projetoId)}/metadados`);
  }

  update(projetoId: string, dto: Partial<MetadadosDto>): Observable<MetadadosDto> {
    return this.http.put<MetadadosDto>(`${this.baseUrl(projetoId)}/metadados`, dto);
  }

  uploadCapa(projetoId: string, file: File): Observable<CapaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CapaUploadResponse>(`${this.baseUrl(projetoId)}/capa`, formData);
  }
}
