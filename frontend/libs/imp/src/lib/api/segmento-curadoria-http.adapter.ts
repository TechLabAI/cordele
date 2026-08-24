/**
 * segmento-curadoria-http.adapter.ts — HTTP adapter (stub compilável; URLs from api-contract §8).
 * Activated by imp.providers.ts when adapter: 'http'.
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { IgnoredSegmentsResponse, SegmentoCuradoriaDto } from '../models/imp.models';
import { SegmentoCuradoriaPort } from './segmento-curadoria.port';

const BASE = '/api/imp/manuscripts';

@Injectable({ providedIn: 'root' })
export class SegmentoCuradoriaHttpAdapter implements SegmentoCuradoriaPort {
  private readonly http = inject(HttpClient);

  ignore(manuscritoId: string, segmentoId: string): Observable<SegmentoCuradoriaDto> {
    return this.http.post<SegmentoCuradoriaDto>(
      `${BASE}/${manuscritoId}/segmentos/${segmentoId}/ignore`,
      {},
    );
  }

  restoreIgnore(manuscritoId: string, segmentoId: string): Observable<void> {
    return this.http
      .delete(`${BASE}/${manuscritoId}/segmentos/${segmentoId}/ignore`)
      .pipe(map(() => undefined));
  }

  getIgnored(manuscritoId: string): Observable<IgnoredSegmentsResponse> {
    return this.http.get<IgnoredSegmentsResponse>(
      `${BASE}/${manuscritoId}/segmentos/ignored`,
    );
  }

  confirmEstrutura(manuscritoId: string): Observable<void> {
    return this.http
      .post(`${BASE}/${manuscritoId}/confirm-estrutura`, {})
      .pipe(map(() => undefined));
  }
}
