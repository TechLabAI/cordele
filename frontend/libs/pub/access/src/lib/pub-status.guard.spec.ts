/**
 * pub-status.guard.spec.ts — Unit tests for pubStatusGuard (FE-PUB-022 / P5).
 *
 * Verifies:
 *   history mode:
 *     - Always returns true (no HTTP call)
 *   export mode:
 *     - em_composicao → returns true (HTTP GET /api/proj/projetos/:id)
 *     - rascunho → redirects to /proj/biblioteca-de-projetos
 *     - publicado → redirects to /proj/biblioteca-de-projetos
 *     - com_erros → redirects to /proj/biblioteca-de-projetos
 *     - HTTP error (404/5xx) → redirects to /proj/biblioteca-de-projetos
 *     - Missing projetoId → redirects without HTTP call
 *
 * Note: HttpTestingController.flush() is synchronous — no fakeAsync/tick needed.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { ACCESS_EMPRESA_ID } from '@cordele/shared/access-http-base';
import { pubStatusGuard } from './pub-status.guard';

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';

function makeRoute(projetoId: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: {
      get: (key: string) => (key === 'projetoId' ? projetoId : null),
      has: (_key: string) => false,
      getAll: (_key: string) => [],
      keys: [],
    },
  } as unknown as ActivatedRouteSnapshot;
}

describe('pubStatusGuard', () => {
  let httpMock: HttpTestingController;
  let createUrlTreeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createUrlTreeSpy = vi.fn((commands: string[]) =>
      ({ toString: () => commands.join('/') } as unknown as UrlTree),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp_aetos' },
        { provide: Router, useValue: { createUrlTree: createUrlTreeSpy } },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── history mode ─────────────────────────────────────────────────────────────

  describe('history mode', () => {
    it('should return true without HTTP call', () => {
      const route = makeRoute(PROJECT_ID);
      const result = TestBed.runInInjectionContext(() =>
        pubStatusGuard('history')(route, {} as never),
      );

      httpMock.expectNone(`/api/proj/projetos/${PROJECT_ID}`);
      expect(result).toBe(true);
    });

    it('should return true even for a null projetoId (no HTTP)', () => {
      const route = makeRoute(null);
      const result = TestBed.runInInjectionContext(() =>
        pubStatusGuard('history')(route, {} as never),
      );

      httpMock.expectNone(`/api/proj/projetos/`);
      expect(result).toBe(true);
    });
  });

  // ── export mode ──────────────────────────────────────────────────────────────

  describe('export mode', () => {
    it('em_composicao → returns true', () => {
      const route = makeRoute(PROJECT_ID);
      let capturedResult: boolean | UrlTree | undefined;

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe(r => { capturedResult = r; });
      });

      const req = httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`);
      expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
      req.flush({ id: PROJECT_ID, status: 'em_composicao' });

      expect(capturedResult).toBe(true);
      expect(createUrlTreeSpy).not.toHaveBeenCalled();
    });

    it('rascunho → redirects to /proj/biblioteca-de-projetos', () => {
      const route = makeRoute(PROJECT_ID);

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe();
      });

      httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`).flush({ id: PROJECT_ID, status: 'rascunho' });

      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });

    it('publicado → redirects to /proj/biblioteca-de-projetos', () => {
      const route = makeRoute(PROJECT_ID);

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe();
      });

      httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`).flush({ id: PROJECT_ID, status: 'publicado' });

      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });

    it('com_erros → redirects to /proj/biblioteca-de-projetos', () => {
      const route = makeRoute(PROJECT_ID);

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe();
      });

      httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`).flush({ id: PROJECT_ID, status: 'com_erros' });

      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });

    it('HTTP 404 → redirects to /proj/biblioteca-de-projetos (safe degradation)', () => {
      const route = makeRoute(PROJECT_ID);

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe();
      });

      httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`).flush(
        { message: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });

    it('HTTP 500 → redirects to /proj/biblioteca-de-projetos (safe degradation)', () => {
      const route = makeRoute(PROJECT_ID);

      TestBed.runInInjectionContext(() => {
        const obs = pubStatusGuard('export')(route, {} as never) as Observable<boolean | UrlTree>;
        obs.subscribe();
      });

      httpMock.expectOne(`/api/proj/projetos/${PROJECT_ID}`).flush(
        { message: 'Internal Server Error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });

    it('missing projetoId → redirects without HTTP call', () => {
      const route = makeRoute(null);

      TestBed.runInInjectionContext(() => {
        pubStatusGuard('export')(route, {} as never);
      });

      httpMock.expectNone(`/api/proj/projetos/`);
      expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    });
  });
});
