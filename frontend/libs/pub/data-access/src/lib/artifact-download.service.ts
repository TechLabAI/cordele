/**
 * artifact-download.service.ts — Signed-URL download service (FE-PUB-010 / SPEC-04 §4.4).
 *
 * Responsibilities:
 *   - Mint a fresh short-TTL signed URL via PublicacaoApiService.
 *   - Open the URL in a new tab (window.open). SPA never proxies bytes (D-F).
 *   - On expired/401/404 signed URL: auto re-fetch once, then surface inline error.
 *   - Never reuses a stale arquivoUrl beyond its TTL.
 *   - Gate: only called when podeBaixar is true (pre-empts 409 artifact-not-available).
 *
 * RULE-NX-05: no raw HttpClient — delegates to PublicacaoApiService (which delegates to port).
 *
 * FE-PUB-025: DownloadResult now carries `status` instead of `success`:
 *   'refetching' — emitted immediately when a 401/404 triggers the auto re-fetch,
 *                  before the second API call is made. Callers use this to show a notice.
 *   'success'    — emitted once the file is open in a new tab.
 */
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concat, map, of, throwError } from 'rxjs';
import { PublicacaoApiService } from './publicacao-api.service';
import { SignedDownloadUrl } from './models/pub.models';

export interface DownloadResult {
  /** 'refetching': signed URL expired, re-fetching now; 'success': file open in new tab. */
  status: 'success' | 'refetching';
  arquivoUrl?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ArtifactDownloadService {
  private readonly api = inject(PublicacaoApiService);

  /**
   * Mint a fresh signed URL for the given publication.
   * Caller is responsible for calling only when podeBaixar is true.
   */
  getSignedUrl(projetoId: string, publicacaoId: string): Observable<SignedDownloadUrl> {
    return this.api.getDownloadUrl(projetoId, publicacaoId);
  }

  /**
   * Mint a signed URL and open it in a new browser context.
   * On expiry (401/404), emits {status:'refetching'} then re-fetches once.
   *
   * SPEC-04 §4.4: SPA never proxies bytes. Never falls back to a public link.
   * FE-PUB-025: emits 'refetching' before the second attempt so callers can show a notice.
   */
  download(projetoId: string, publicacaoId: string): Observable<DownloadResult> {
    return this.api.getDownloadUrl(projetoId, publicacaoId).pipe(
      map(signed => {
        window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
        return { status: 'success' as const, arquivoUrl: signed.arquivoUrl };
      }),
      catchError(err => {
        const status = (err as { status?: number }).status;
        // 401 / 404 on the signed URL = expired → re-fetch once (SPEC-04 §4.4)
        if (status === 401 || status === 404) {
          return this._refetchAndOpen(projetoId, publicacaoId);
        }
        // Other errors (409 artifact-not-available, 5xx) propagate
        return throwError(() => err);
      }),
    );
  }

  /**
   * Re-fetch a fresh signed URL once (auto-retry on expiry).
   * Emits {status:'refetching'} synchronously before the second API call (FE-PUB-025)
   * so that the caller can show a notice without waiting for the network round-trip.
   * If the second attempt also fails, the error propagates to the caller.
   */
  private _refetchAndOpen(projetoId: string, publicacaoId: string): Observable<DownloadResult> {
    return concat(
      of({ status: 'refetching' as const }),
      this.api.getDownloadUrl(projetoId, publicacaoId).pipe(
        map((signed: SignedDownloadUrl) => {
          window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
          return { status: 'success' as const, arquivoUrl: signed.arquivoUrl };
        }),
        catchError(err =>
          throwError(() => ({
            ...(err as object),
            message: 'O link de download expirou. Tente novamente.',
          })),
        ),
      ),
    );
  }
}
