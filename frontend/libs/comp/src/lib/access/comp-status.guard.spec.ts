/**
 * comp-status.guard.spec.ts — unit tests for compStatusGuard.
 * INT-FE-COMP-003 (P4): verifies real proj-service integration via AccessHttpClient.
 *
 * Tests:
 *   - em_composicao → returns true (access granted)
 *   - rascunho → redirects to /imp/projetos/:id/importar
 *   - publicado → redirects to /proj/projetos/:id/historico
 *   - com_erros → redirects to /proj/projetos/:id/historico
 *   - HTTP error → redirects to /proj/biblioteca-de-projetos
 *   - Missing projetoId → redirects to /proj/biblioteca-de-projetos
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { lastValueFrom } from 'rxjs';
import { Observable } from 'rxjs';
import { ACCESS_EMPRESA_ID } from '@cordele/shared/access-http-base';
import { compStatusGuard } from './comp-status.guard';

const PROJECT_ID = 'proj-guard-001';

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

function urlTreeToString(tree: UrlTree): string {
  return tree.toString();
}

describe('compStatusGuard', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp_aetos' },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: unknown[]) =>
              ({ toString: () => (commands as string[]).join('/') } as UrlTree),
          },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('em_composicao → returns true', async () => {
    const route = makeRoute(PROJECT_ID);

    const resultPromise = TestBed.runInInjectionContext(() => {
      const obs = compStatusGuard(route, {} as never) as Observable<boolean | UrlTree>;
      return lastValueFrom(obs);
    });

    const req = httpMock.expectOne(`/api/v1/proj/projetos/${PROJECT_ID}`);
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
    req.flush({ id: PROJECT_ID, status: 'em_composicao' });

    const val = await resultPromise;
    expect(val).toBe(true);
  });

  it('rascunho → redirects to imp/projetos/:id/importar', async () => {
    const route = makeRoute(PROJECT_ID);

    const resultPromise = TestBed.runInInjectionContext(() => {
      const obs = compStatusGuard(route, {} as never) as Observable<boolean | UrlTree>;
      return lastValueFrom(obs);
    });

    const req = httpMock.expectOne(`/api/v1/proj/projetos/${PROJECT_ID}`);
    req.flush({ id: PROJECT_ID, status: 'rascunho' });

    const val = await resultPromise;
    const url = urlTreeToString(val as UrlTree);
    expect(url).toContain('imp');
    expect(url).toContain(PROJECT_ID);
    expect(url).toContain('importar');
  });

  it('publicado → redirects to proj/projetos/:id/historico', async () => {
    const route = makeRoute(PROJECT_ID);

    const resultPromise = TestBed.runInInjectionContext(() => {
      const obs = compStatusGuard(route, {} as never) as Observable<boolean | UrlTree>;
      return lastValueFrom(obs);
    });

    const req = httpMock.expectOne(`/api/v1/proj/projetos/${PROJECT_ID}`);
    req.flush({ id: PROJECT_ID, status: 'publicado' });

    const val = await resultPromise;
    const url = urlTreeToString(val as UrlTree);
    expect(url).toContain('proj');
    expect(url).toContain('historico');
  });

  it('com_erros → redirects to proj/projetos/:id/historico', async () => {
    const route = makeRoute(PROJECT_ID);

    const resultPromise = TestBed.runInInjectionContext(() => {
      const obs = compStatusGuard(route, {} as never) as Observable<boolean | UrlTree>;
      return lastValueFrom(obs);
    });

    const req = httpMock.expectOne(`/api/v1/proj/projetos/${PROJECT_ID}`);
    req.flush({ id: PROJECT_ID, status: 'com_erros' });

    const val = await resultPromise;
    const url = urlTreeToString(val as UrlTree);
    expect(url).toContain('proj');
    expect(url).toContain('historico');
  });

  it('HTTP error → redirects to /proj/biblioteca-de-projetos', async () => {
    const route = makeRoute(PROJECT_ID);

    const resultPromise = TestBed.runInInjectionContext(() => {
      const obs = compStatusGuard(route, {} as never) as Observable<boolean | UrlTree>;
      return lastValueFrom(obs);
    });

    const req = httpMock.expectOne(`/api/v1/proj/projetos/${PROJECT_ID}`);
    req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const val = await resultPromise;
    const url = urlTreeToString(val as UrlTree);
    expect(url).toContain('biblioteca-de-projetos');
  });

  it('missing projetoId → redirects to library without HTTP call', () => {
    const route = makeRoute(null);

    const result = TestBed.runInInjectionContext(() =>
      compStatusGuard(route, {} as never),
    );

    httpMock.expectNone(`/api/v1/proj/projetos/`);
    const url = urlTreeToString(result as UrlTree);
    expect(url).toContain('biblioteca-de-projetos');
  });
});
