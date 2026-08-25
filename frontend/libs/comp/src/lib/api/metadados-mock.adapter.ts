/**
 * metadados-mock.adapter.ts — In-memory mock for MetadadosPort (dev default, 400ms delay).
 * Seed data aligned with design-reference shared/data-model shapes.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { CapaUploadResponse, MetadadosDto } from '../models/comp.models';
import { MetadadosPort } from './metadados.port';

const MOCK_DELAY = 400;

const MOCK_METADADOS: Record<string, MetadadosDto> = {
  'proj-001': {
    projetoId: 'proj-001',
    titulo: 'Romance das Cidades',
    autor: 'Eliana Moraes',
    isbn: null,
    idioma: 'pt',
    categoria: 'Romance contemporâneo',
    capaUrl: null,
    materialized: true,
  },
};

const DEFAULT_METADADOS: MetadadosDto = {
  titulo: '',
  autor: '',
  isbn: null,
  idioma: 'pt',
  categoria: null,
  capaUrl: null,
  materialized: false,
};

@Injectable({ providedIn: 'root' })
export class MetadadosMockAdapter implements MetadadosPort {
  private readonly store: Record<string, MetadadosDto> = { ...MOCK_METADADOS };

  get(projetoId: string): Observable<MetadadosDto> {
    const existing = this.store[projetoId];
    return of(existing ?? { ...DEFAULT_METADADOS, projetoId }).pipe(delay(MOCK_DELAY));
  }

  update(projetoId: string, dto: Partial<MetadadosDto>): Observable<MetadadosDto> {
    const current = this.store[projetoId] ?? { ...DEFAULT_METADADOS, projetoId };
    const updated: MetadadosDto = { ...current, ...dto, projetoId, materialized: true };
    this.store[projetoId] = updated;
    return of(updated).pipe(delay(MOCK_DELAY));
  }

  uploadCapa(projetoId: string, file: File): Observable<CapaUploadResponse> {
    // Mock: create an object URL for preview purposes
    const capaUrl = URL.createObjectURL(file);
    if (this.store[projetoId]) {
      this.store[projetoId] = { ...this.store[projetoId], capaUrl };
    }
    return of({ capaUrl }).pipe(delay(MOCK_DELAY));
  }
}
