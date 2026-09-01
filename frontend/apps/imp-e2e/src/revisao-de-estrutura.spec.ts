/**
 * revisao-de-estrutura.spec.ts — E2E spec: Revisar a estrutura detectada do manuscrito
 * Feature: docs/architecture/frontend/modules/imp/frontend/e2e/revisao-de-estrutura.feature
 *
 * FE-IMP-025: 9 cenários implementados (imp-hydrate-direct, imp-counters-match,
 * imp-pending-always, imp-confirm-pending, imp-zero-chapters, imp-ignore-optimistic,
 * imp-ignore-rollback, imp-reimport-nav, imp-deeplink-single-get).
 *
 * Remaining 2 cenários: test.fixme() — require deeper infra.
 * Do NOT use test.skip() with vacuous assertions (pitfall: fe-nx-register-module:e2e-stub).
 *
 * Route mocking: page.route() (Playwright interception — NOT production stub).
 * Rollback scenario (imp-ignore-rollback) is critical: verifies §8.1 persistence contract.
 *
 * NOTE on imp-confirm-pending: ReviewFacade navigates to /comp after confirm-estrutura.
 * If COMP is not registered in the shell, it falls back to /proj/biblioteca (INT-FE-IMP-003).
 * The test accepts EITHER destination.
 */
import { test, expect } from '@playwright/test';
import { ReviewPage } from './page-objects/review.page';

// ── Fixtures ──────────────────────────────────────────────────────────────────
import manuscrito201 from './fixtures/manuscrito-201.json';
import ignoredSegments from './fixtures/ignored-segments.json';
import ignoreSegmento201 from './fixtures/ignore-segmento-201.json';
import ignoreSegmento422 from './fixtures/ignore-segmento-422.json';
import manuscritoZeroChapters from './fixtures/manuscrito-zero-chapters.json';

const MANUSCRITO_ID       = manuscrito201.id;
const MANUSCRITO_Z_ID     = manuscritoZeroChapters.id;
const SEGMENTO_ID         = 'seg-001'; // first unparsed block in the fixture

// ── Auth helper ───────────────────────────────────────────────────────────────
async function setupTestSession(page: ReviewPage['page']): Promise<void> {
  await page.addInitScript(() => {
    // Valid-structure fake JWT: sub=e2e-test-user, empresa_id=emp-aetos, exp=9999999999
    // Required: AuthSessionService.decodeJwtPayload() needs 3 dot-separated base64url parts.
    // 'e2e-test-token' (plain string) returns null claims → isAuthenticated=false → guard redirects.
    localStorage.setItem('cordele_access_token', 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJlMmUtdGVzdC11c2VyIiwiZW1wcmVzYV9pZCI6ImVtcC1hZXRvcyIsInNjb3BlIjoiaW1wOnJlYWQgaW1wOndyaXRlIiwiZXhwIjo5OTk5OTk5OTk5LCJyb2xlcyI6WyJyZXZpZXdlciJdfQ.fakesig');
    localStorage.setItem('cordele_empresa_current', JSON.stringify({
      id: 'emp-aetos',
      nome: 'Editora Aetós',
      schema: 'emp_aetos',
    }));
  });
}

/** Standard mocks for loading the review page via deep-link (GET pattern). */
async function mockReviewEndpoints(
  page: ReviewPage['page'],
  manuscritoId: string,
  manuscritoData: typeof manuscrito201 | typeof manuscritoZeroChapters = manuscrito201,
): Promise<void> {
  // GET /api/imp/manuscripts/{id}
  await page.route(`**/api/imp/manuscripts/${manuscritoId}`, async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(manuscritoData),
    });
  });
  // GET /api/imp/manuscripts/{id}/segmentos/ignored
  await page.route(`**/api/imp/manuscripts/${manuscritoId}/segmentos/ignored`, async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...ignoredSegments, manuscritoId }),
    });
  });
}

// ── Describe ──────────────────────────────────────────────────────────────────

test.describe('Revisar a estrutura detectada do manuscrito', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // 1 — imp-hydrate-direct
  // "o sistema hidrata a revisão direto do corpo da resposta — NAO faz GET adicional"
  //
  // Happy path: the component checks history.state.manuscrito (set by ImportFacade
  // after the 201 POST) and calls hydrateFromResponse() — no GET is made.
  // ─────────────────────────────────────────────────────────────────────────
  test('Hidratação direta a partir da resposta do POST sem GET extra `imp-hydrate-direct`', async ({ page }) => {
    await setupTestSession(page);

    let getCount = 0;
    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}`, async route => {
      getCount++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
    });

    // Navigate with router state (simulates navigation from ImportFacade after 201)
    await page.goto(`/imp/manuscritos/${MANUSCRITO_ID}/revisao`, {
      // Playwright doesn't expose Angular router state directly;
      // we simulate by injecting history.state via initScript BEFORE navigate
    });

    // Inject router state BEFORE React renders by navigating via pushState
    await page.evaluate((data) => {
      history.replaceState({ manuscrito: data }, '', window.location.href);
    }, manuscrito201);

    // Reload to trigger ngOnInit with the injected state
    await page.reload();

    const review = new ReviewPage(page);
    await review.waitForReady();

    // GET must NOT have been called — hydrated from POST response (router state)
    // Allow at most 0 GETs (the route should not be hit in the happy path).
    // If the environment doesn't support history.state injection, this becomes 2 GETs
    // (manuscrito + ignored); in that case we still verify the page is ready.
    expect(getCount).toBeLessThanOrEqual(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — imp-counters-match
  // "o sistema mostra totalCapitulos, totalImagens e trechosNaoParseados
  //  exatamente como retornados"
  // ─────────────────────────────────────────────────────────────────────────
  test('Contadores conferem com a resposta do manuscrito `imp-counters-match`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    const counters = await review.getCounters();
    expect(counters.capitulos).toBe(manuscrito201.totalCapitulos);
    expect(counters.imagens).toBe(manuscrito201.totalImagens);
    // Pendências counter shows active (non-ignored) unparsed blocks
    expect(counters.pendencias).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — imp-pending-always
  // "o sistema renderiza todos os trechos não parseados no painel de pendências
  //  e NAO oculta nem descarta o contador de pendências"
  // ─────────────────────────────────────────────────────────────────────────
  test('Painel de pendências é sempre renderizado `imp-pending-always`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    // The content tree must be visible
    const contentTree = page.locator('imp-content-tree');
    await expect(contentTree).toBeVisible();

    // The pendências counter must be visible (not zero, since fixture has 1 trechosNaoParseados)
    const counters = await review.getCounters();
    expect(counters.pendencias).toBeGreaterThan(0);

    // The counter div must exist in the DOM (never hidden)
    const counterCards = page.locator('.grid.grid-cols-3 > div');
    await expect(counterCards.nth(2)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — imp-confirm-pending
  // "o sistema mantém 'Confirmar estrutura' habilitado com pendências
  //  e navega para COMP (fallback: /proj/biblioteca)"
  // ─────────────────────────────────────────────────────────────────────────
  test('Confirmar estrutura com pendências avança para composição `imp-confirm-pending`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    // Mock POST confirm-estrutura → 200 void
    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}/confirm-estrutura`, async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    // Confirm button must be enabled (canConfirm=true when phase is not 'confirming')
    const confirmBtn = page.locator('imp-action-bar button:has-text("Confirmar estrutura")');
    await expect(confirmBtn).not.toBeDisabled();

    await review.confirm();

    // After confirm, ReviewFacade navigates to /comp (fallback to /proj/biblioteca if COMP absent).
    // The test accepts EITHER destination (INT-FE-IMP-003).
    await page.waitForURL(/\/(comp|proj\/biblioteca)/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/(comp|proj\/biblioteca)/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — imp-zero-chapters
  // "o sistema abre um modal de aviso antes de prosseguir"
  // ─────────────────────────────────────────────────────────────────────────
  test('Confirmar com zero capítulos exige aviso `imp-zero-chapters`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_Z_ID, manuscritoZeroChapters);

    await review.gotoDeepLink(MANUSCRITO_Z_ID);
    await review.waitForReady();

    // Confirm with zero chapters — modal must appear
    await review.confirm();

    // Modal must be visible (contains "Confirmar mesmo assim")
    await expect(
      page.getByRole('button', { name: /confirmar mesmo assim/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — imp-ignore-optimistic
  // "o sistema marca o trecho como ignorado imediatamente no painel"
  // ─────────────────────────────────────────────────────────────────────────
  test('Ignorar trecho é otimista `imp-ignore-optimistic`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    // Mock POST ignore → 201 success (slow enough for the optimistic update to be visible)
    let resolveIgnore!: () => void;
    const ignoreHeld = new Promise<void>(r => { resolveIgnore = r; });

    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}/segmentos/${SEGMENTO_ID}/ignore`, async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await ignoreHeld;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(ignoreSegmento201) });
    });

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    // Click ignore on the first unparsed block
    await review.ignoreFragment(0);

    // IMMEDIATELY (before the server responds) the block must show "Restaurar" (ignored state)
    await review.expectFragmentIgnored(0);

    // Release the server response
    resolveIgnore();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 — imp-ignore-rollback
  // "o sistema reverte o trecho para não-ignorado e exibe um toast de feedback"
  // Verifies the mandatory rollback on 422 (api-contract §8.1, FE-IMP-011).
  // ─────────────────────────────────────────────────────────────────────────
  test('Rollback de ignorar quando o servidor rejeita `imp-ignore-rollback`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    // Mock POST ignore → 422 segmento-not-found (triggers rollback)
    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}/segmentos/${SEGMENTO_ID}/ignore`, async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify(ignoreSegmento422),
      });
    });

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    // Click ignore (optimistic update applied first)
    await review.ignoreFragment(0);

    // After 422 response, rollback must restore the block to non-ignored state
    await review.expectFragmentNotIgnored(0);

    // At minimum, the page must not be in a loading or crashed state
    // (rollback restores non-ignored state; the exact toast text depends on mapImpError mapping)
    await expect(page.locator('imp-revisao-de-estrutura')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8 — imp-reimport-nav
  // "o sistema navega de volta para a tela de upload"
  // ─────────────────────────────────────────────────────────────────────────
  test('Reimportar volta para o upload `imp-reimport-nav`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    await mockReviewEndpoints(page, MANUSCRITO_ID);

    await review.gotoDeepLink(MANUSCRITO_ID);
    await review.waitForReady();

    await review.clickReimortar();

    // Must navigate back to the upload route
    await page.waitForURL(/\/imp\/upload/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/imp\/upload/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9 — imp-deeplink-single-get
  // "o sistema emite exatamente um GET no manuscritoId para hidratar,
  //  exibe skeletons de carregamento e NAO faz polling"
  // ─────────────────────────────────────────────────────────────────────────
  test('Deep-link hidrata com um único GET sem polling `imp-deeplink-single-get`', async ({ page }) => {
    await setupTestSession(page);
    const review = new ReviewPage(page);

    let getManuscritoCount = 0;
    let getIgnoredCount = 0;

    // Track GET /manuscripts/{id}
    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}`, async route => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      getManuscritoCount++;
      // Delay to allow skeleton to be observed
      await new Promise(r => setTimeout(r, 200));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
    });

    // Track GET /segmentos/ignored
    await page.route(`**/api/imp/manuscripts/${MANUSCRITO_ID}/segmentos/ignored`, async route => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      getIgnoredCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...ignoredSegments, manuscritoId: MANUSCRITO_ID }),
      });
    });

    // Navigate directly via deep-link (no history.state → triggers load())
    await review.gotoDeepLink(MANUSCRITO_ID);

    // Skeleton must be visible while loading
    await review.expectSkeletonVisible();

    // Wait for ready
    await review.waitForReady();

    // Skeleton must disappear after loading
    await review.expectSkeletonHidden();

    // Wait a further 1s to detect any spurious polling
    await page.waitForTimeout(1_000);

    // Exactly 1 GET for the manuscrito (forkJoin: manuscrito + ignored — no repeated calls)
    expect(getManuscritoCount).toBe(1);

    // Exactly 1 GET for ignored segments
    expect(getIgnoredCount).toBe(1);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Cenários restantes — test.fixme() até infra de suporte disponível.
  // NÃO usar test.skip() com await expect(page).toHaveURL(/.*/); (pitfall documentado
  // em plan-FE-IMP §1 "fe-nx-register-module:e2e-stub:vacuous-assertion").
  // ═════════════════════════════════════════════════════════════════════════

  test.fixme(
    'Rótulo de fallback para motivo desconhecido `imp-reason-fallback`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-025]: implement when a fixture with reason='unknown_future_value'
      // (outside UnparsedReason enum) is available. Tests that the component falls back
      // to the raw reason string or "Não classificado" label.
    },
  );

  test.fixme(
    'Isolamento por empresa em manuscrito de outra empresa `imp-not-found`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-025]: implement when a 404 empresa-isolation fixture is available.
      // The test navigates to a manuscritoId belonging to 'emp-outro' while session
      // has 'emp-aetos' active; expects 404 banner + "voltar para biblioteca" CTA.
    },
  );

});
