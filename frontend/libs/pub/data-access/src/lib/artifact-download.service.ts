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
 */
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { PublicacaoApiService } from './publicacao-api.service';
import { SignedDownloadUrl } from './models/pub.models';

export interface DownloadResult {
  success: boolean;
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
   * On expiry (401/404), re-fetches once before emitting an error.
   *
   * SPEC-04 §4.4: SPA never proxies bytes. Never falls back to a public link.
   */
  download(projetoId: string, publicacaoId: string): Observable<DownloadResult> {
    return this.api.getDownloadUrl(projetoId, publicacaoId).pipe(
      map(signed => {
        window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
        return { success: true, arquivoUrl: signed.arquivoUrl };
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
   * If the second attempt also fails, the error propagates to the caller.
   */
  private _refetchAndOpen(projetoId: string, publicacaoId: string): Observable<DownloadResult> {
    return this.api.getDownloadUrl(projetoId, publicacaoId).pipe(
      switchMap(signed => {
        window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
        return [{ success: true, arquivoUrl: signed.arquivoUrl }];
      }),
      catchError(err =>
        throwError(() => ({
          ...(err as object),
          message: 'O link de download expirou. Gerando um novo link…',
        })),
      ),
    );
  }
}
