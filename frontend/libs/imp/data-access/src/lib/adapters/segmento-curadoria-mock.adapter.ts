/**
 * segmento-curadoria-mock.adapter.ts — In-memory mock (dev default, 400ms delay).
 * Implements persistent rollback semantics (FE-IMP-011 / api-contract §8).
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 * NOTE: This adapter is a DI test double used only in dev/test via imp.providers.ts.
 *       It must NOT be used in production; production uses SegmentoCuradoriaHttpAdapter.
 */
import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';
import { IgnoredSegmentsResponse, SegmentoCuradoriaDto } from '../models/imp.models';
import { SegmentoCuradoriaPort } from '../ports/segmento-curadoria.port';

const MOCK_DELAY = 400;

@Injectable({ providedIn: 'root' })
export class SegmentoCuradoriaMockAdapter implements SegmentoCuradoriaPort {
  /** In-memory store: manuscritoId → Set<segmentoId> */
  private readonly ignored = new Map<string, Set<string>>();

  ignore(manuscritoId: string, segmentoId: string): Observable<SegmentoCuradoriaDto> {
    if (!this.ignored.has(manuscritoId)) {
      this.ignored.set(manuscritoId, new Set());
    }
    const segSet = this.ignored.get(manuscritoId);
    if (segSet) { segSet.add(segmentoId); }
    const dto: SegmentoCuradoriaDto = {
      id:           `sc-${Date.now()}`,
      manuscritoId,
      segmentoId,
      criadoEm:     new Date().toISOString(),
    };
    return of(dto).pipe(delay(MOCK_DELAY));
  }

  restoreIgnore(manuscritoId: string, segmentoId: string): Observable<void> {
    const set = this.ignored.get(manuscritoId);
    if (!set?.has(segmentoId)) {
      return throwError(() => new Error(`segmento-not-ignored: ${segmentoId}`));
    }
    set.delete(segmentoId);
    return of(undefined as void).pipe(delay(MOCK_DELAY));
  }

  getIgnored(manuscritoId: string): Observable<IgnoredSegmentsResponse> {
    const ids = [...(this.ignored.get(manuscritoId) ?? [])];
    return of({ manuscritoId, ignoredSegmentoIds: ids }).pipe(delay(MOCK_DELAY));
  }

  confirmEstrutura(_manuscritoId: string): Observable<void> {
    // Mock: always succeeds. Real adapter calls POST /confirm-estrutura (§8.2).
    return of(undefined as void).pipe(delay(MOCK_DELAY));
  }
}
