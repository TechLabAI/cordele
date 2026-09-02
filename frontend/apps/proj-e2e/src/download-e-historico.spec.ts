/**
 * E2E spec: Download e histórico de exportações (T08)
 * Feature: FE-PROJ-025 — E2E fluxo principal T08
 * Gate: A5 e2e-validate (P3 proj-e2e).
 *
 * HTTP mocking: Playwright `route.fulfill()` for all PROJ API calls.
 * Auth seeding: Angular dev-mode `window.ng.getInjector()` via auth-helpers.ts.
 *
 * Real tests (executed): Group 1 (guard UUID) + Group 2 (fluxo principal).
 * Remaining scenarios: test.fixme() — awaiting selectors / component completeness (P4+).
 */
import { test, expect } from '@playwright/test';
import {
  seedAuthSession,
  SCOPES_PROJ_FULL,
} from './support/auth-helpers';
import {
  PROJETO_ID,
  PROJETO_DETAIL_FIXTURE,
  mockT08HappyPath,
  mockListProjetos,
  mockGetProjetoNotFound,
} from './support/api-mocks';

/** Well-formed UUID for the happy-path T08 route. */
const HISTORY_URL  = `/proj/projetos/${PROJETO_ID}/historico`;
/** Non-UUID string — triggers projProjetoGuard redirect. */
const NON_UUID_URL = '/proj/projetos/nao-uuid-invalido/historico';

// ─── Group 1 — Guardas de rota ─────────────────────────────────────────────────

test.describe('Guardas de rota (T08)', () => {

  test(
    'Redireciona para biblioteca quando projetoId não é UUID válido `proj-guard-projeto`',
    async ({ page }) => {
      await page.goto('/');
      await seedAuthSession(page, SCOPES_PROJ_FULL);
      // Also mock the list endpoint so the redirect destination renders without error
      await mockListProjetos(page, []);

      await page.goto(NON_UUID_URL);
      // projProjetoGuard fires → createUrlTree(['/proj', 'biblioteca-de-projetos'])
      await expect(page).toHaveURL(/biblioteca-de-projetos/, { timeout: 10_000 });
    },
  );

  test.fixme(
    'Redireciona para /login quando não há sessão ativa (T08) `proj-guard-session`',
    async ({ page }) => {
      // No auth seeded → authGuard fires
      await page.goto(HISTORY_URL);
      await expect(page).toHaveURL(/login|\//);
    },
  );

});

// ─── Group 2 — Fluxo principal T08 — FE-PROJ-025 ─────────────────────────────

test.describe('Fluxo principal — Download e Histórico (T08)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedAuthSession(page, SCOPES_PROJ_FULL);
  });

  test(
    'Exibe histórico de publicações para projeto válido `proj-history-load`',
    async ({ page }) => {
      await mockT08HappyPath(page);
      await page.goto(HISTORY_URL);

      // h2 "Histórico de exportações" must appear when status=ready
      await expect(page.getByRole('heading', { level: 2, name: /Histórico de exportações/i }))
        .toBeVisible({ timeout: 10_000 });

      // Project name from the detail fixture must appear in the h1
      await expect(page.getByRole('heading', { level: 1, name: PROJETO_DETAIL_FIXTURE.nome }))
        .toBeVisible();
    },
  );

  test(
    'Exibe estado not-found quando projeto retorna 404 `proj-err-not-found`',
    async ({ page }) => {
      await mockGetProjetoNotFound(page, PROJETO_ID);
      await page.goto(HISTORY_URL);

      // HistoryFacade sets status='not-found' when getProjeto returns 404
      await expect(page.getByText(/Projeto não encontrado/i))
        .toBeVisible({ timeout: 10_000 });
    },
  );

  test.fixme(
    'Carga paralela do header e do histórico `proj-history-load`',
    async () => {
      // TODO[FE-PROJ-P4]: verify getProjeto and listPublicacoes are called concurrently
    },
  );

  test.fixme(
    'Linha não baixável sem affordance `proj-row-nondownloadable`',
    async ({ page }) => {
      // TODO[FE-PROJ-P4]: mock publicacao with arquivoUrl=null, assert "inválido" text and no download button
      await mockT08HappyPath(page);
      await page.goto(HISTORY_URL);
    },
  );

  test.fixme(
    'Download por URL assinada sem proxy `proj-download-signed`',
    async () => {
      // TODO[FE-PROJ-P4]: mock resolveDownloadUrl, click Baixar, assert window.open called
    },
  );

  test.fixme(
    'Reabrir para revisão aciona reopen e vai ao COMP `proj-reopen-post`',
    async () => {
      // TODO[FE-PROJ-P4]: mock reopen 200, click "Ajustar metadados", assert navigation to /comp
    },
  );

  test.fixme(
    'Ações de reopen desabilitadas enquanto em andamento `proj-reopen-pending`',
    async () => {
      // TODO[FE-PROJ-P4]: slow reopen mock, assert buttons disabled during reopenPending=true
    },
  );

  test.fixme(
    'Visibilidade do reopen por status e permissão `proj-reopen-visibility` `proj-perm-reopen` `proj-flag-reopen`',
    async () => {
      // TODO[FE-PROJ-P4]: verify canReopen only for status publicado/com_erros
    },
  );

  test.fixme(
    'Reopen ilegal a partir de rascunho `proj-reopen-illegal` `proj-err-illegal-reopen`',
    async () => {
      // TODO[FE-PROJ-P4]: mock reopen 409, assert error toast visible and reopenPending=false
    },
  );

  test.fixme(
    'Download de versão sem artefato `proj-err-artifact`',
    async () => {
      // TODO[FE-PROJ-P4]: mock resolveDownloadUrl 404/409, assert non-blocking behavior
    },
  );

  test.fixme(
    'Histórico degradado do PUB `proj-err-degraded`',
    async ({ page }) => {
      // TODO[FE-PROJ-P4]: mock listPublicacoes with 5xx, assert degraded notice visible
      await mockT08HappyPath(page);
      await page.goto(HISTORY_URL);
    },
  );

  test.fixme(
    'Limpeza ao sair da tela `proj-shell-destroy`',
    async () => {
      // TODO[FE-PROJ-P5]: verify HistoryFacade state reset on ngOnDestroy / route change
    },
  );

});
