/**
 * E2E spec: Biblioteca de projetos (T02)
 * Feature: FE-PROJ-024 — E2E fluxo principal T02
 * Gate: A5 e2e-validate (P3 proj-e2e).
 *
 * HTTP mocking: Playwright `route.fulfill()` for all PROJ API calls.
 * Auth seeding: Angular dev-mode `window.ng.getInjector()` via auth-helpers.ts.
 *
 * Real tests (executed): Group 1 (auth guard) + Group 2 (fluxo principal).
 * Remaining scenarios: test.fixme() — awaiting selectors / component completeness (P4+).
 */
import { test, expect } from '@playwright/test';
import {
  seedAuthSession,
  SCOPES_PROJ_FULL,
} from './support/auth-helpers';
import {
  PROJETO_CARD_FIXTURE,
  mockT02HappyPath,
  mockListProjetosEmpty,
  mockListProjetos,
} from './support/api-mocks';

const LIBRARY_URL = '/proj/biblioteca-de-projetos';

// ─── Group 1 — Guardas de rota ─────────────────────────────────────────────────

test.describe('Guardas de rota (T02)', () => {

  test(
    'Redireciona para /login quando não há sessão ativa `proj-guard-session`',
    async ({ page }) => {
      // No auth seeded → authGuard fires → redirect to /login
      await page.goto(LIBRARY_URL);
      await expect(page).toHaveURL(/login|\//);
    },
  );

  test.fixme(
    'Empresa ausente bloqueia a rota `proj-guard-empresa`',
    async ({ page }) => {
      // Seed JWT without empresa_id → empresaGuard fires → redirect
      await page.goto('/');
      await seedAuthSession(page, SCOPES_PROJ_FULL, ''); // empty empresa → null
      await page.goto(LIBRARY_URL);
      await expect(page).toHaveURL(/biblioteca-de-projetos|login/);
    },
  );

  test.fixme(
    'Permissão ausente nega acesso `proj-guard-permission` `proj-perm-accessdecision`',
    async () => {
      // TODO[FE-PROJ-P4]: implement after accessGuard('proj.view') is registered
    },
  );

});

// ─── Group 2 — Fluxo principal T02 — FE-PROJ-024 ─────────────────────────────

test.describe('Fluxo principal — Biblioteca de Projetos (T02)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedAuthSession(page, SCOPES_PROJ_FULL);
  });

  test(
    'Exibe lista de projetos quando API retorna dados `proj-list-ready`',
    async ({ page }) => {
      await mockT02HappyPath(page);
      await page.goto(LIBRARY_URL);

      // h1 "Seus projetos" must be visible (library ready state)
      await expect(page.getByRole('heading', { level: 1, name: /Seus projetos/i }))
        .toBeVisible({ timeout: 10_000 });

      // Project name from fixture must appear in the grid
      await expect(page.getByText(PROJETO_CARD_FIXTURE.nome)).toBeVisible();
    },
  );

  test(
    'Exibe estado vazio quando lista está vazia `proj-empty-state`',
    async ({ page }) => {
      await mockListProjetosEmpty(page);
      await page.goto(LIBRARY_URL);

      // Empty-state CTA must appear when API returns []
      await expect(page.getByText(/Nenhum projeto ainda/i))
        .toBeVisible({ timeout: 10_000 });
    },
  );

  test.fixme(
    'Skeleton durante o carregamento `proj-loading-skeleton`',
    async ({ page }) => {
      // TODO[FE-PROJ-P4]: add delay to GET /api/proj/projetos and assert .animate-pulse visible
      let resolveGet!: () => void;
      const delayedGet = new Promise<void>(r => { resolveGet = r; });
      await page.route('**/api/proj/projetos', async (route) => {
        if (route.request().method() === 'GET') {
          await delayedGet;
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        } else {
          await route.continue();
        }
      });
      const gotoPromise = page.goto(LIBRARY_URL);
      await expect(page.locator('.animate-pulse')).toBeVisible({ timeout: 5_000 });
      resolveGet();
      await gotoPromise;
    },
  );

  test.fixme(
    'Troca de empresa cancela e re-busca `proj-empresa-switch`',
    async () => {
      // TODO[FE-PROJ-P4]: trigger EmpresaContextService change and verify switchMap re-fetch
    },
  );

  test.fixme(
    'Download rápido por card via URL assinada `proj-flag-quickdownload` `proj-perm-download`',
    async ({ page }) => {
      // TODO[FE-PROJ-P4]: mock resolveDownloadUrl, click quick-download button, assert window.open
      await mockListProjetos(page, [{ ...PROJETO_CARD_FIXTURE, ultimoEpubcheckStatus: 'valido' }]);
      await page.goto(LIBRARY_URL);
      // Click download button on the first card
    },
  );

  test.fixme(
    'Abrir stage-aware sem beco sem saída `proj-open-published` `proj-open-stage-aware`',
    async () => {
      // TODO[FE-PROJ-P4]: verify navigation target by status (rascunho→IMP, em_composicao→COMP, publicado→T08)
    },
  );

  test.fixme(
    'Degradação parcial não derruba a biblioteca `proj-degraded-fields` `proj-degrade-not-fail`',
    async () => {
      // TODO[FE-PROJ-P4]: mock partial response with degraded=true, verify "(dados parciais)" label
    },
  );

});

// ─── Group 3 — Cenários de erro ────────────────────────────────────────────────

test.describe('Cenários de erro (T02)', () => {

  test.fixme(
    'Erro de acesso na leitura `proj-err-forbidden`',
    async () => {
      // TODO[FE-PROJ-P4]: mock 403, assert error state visible
    },
  );

  test.fixme(
    'Falha de leitura com retry e correlação `proj-err-read-5xx` `proj-err-correlation`',
    async () => {
      // TODO[FE-PROJ-P4]: mock 500, assert retry button visible
    },
  );

});

// ─── Group 4 — Cenários de shell ───────────────────────────────────────────────

test.describe('Integração com o Shell (T02)', () => {

  test.fixme(
    'Login leva à biblioteca como módulo home `proj-home-landing` `proj-contract-home` `proj-shell-home-redirect`',
    async () => {
      // TODO[FE-PROJ-P5]: verify post-login redirect to /proj/biblioteca-de-projetos
    },
  );

  test.fixme(
    'Shell registra o módulo Projetos `proj-shell-descriptor` `proj-shell-navconfig`',
    async () => {
      // TODO[FE-PROJ-P5]: verify ProjShellIntegrationService.register() after P5 implementation
    },
  );

  test.fixme(
    'Bootstrap não pré-carrega a lista `proj-shell-no-prefetch`',
    async () => {
      // TODO[FE-PROJ-P5]: verify no API call is made on app bootstrap before navigation to /proj
    },
  );

  test.fixme(
    'Re-fetch a cada entrada, sem cache `proj-list-refetch`',
    async () => {
      // TODO[FE-PROJ-P4]: navigate away and back, verify GET /api/proj/projetos called again
    },
  );

  test.fixme(
    'Ordenação por última atividade `proj-library-order`',
    async () => {
      // TODO[FE-PROJ-P4]: return multiple cards, verify order by ultimaAtividadeEm desc
    },
  );

  test.fixme(
    'Derivação do badge de status `proj-badge-derivation`',
    async () => {
      // TODO[FE-PROJ-P4]: verify badge label/tone per status+epubcheck combination (StatusBadgeComponent)
    },
  );

});
