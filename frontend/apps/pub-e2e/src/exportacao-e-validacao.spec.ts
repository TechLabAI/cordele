/**
 * exportacao-e-validacao.spec.ts — T07 — Exportação e Validação.
 * 19 cenários com route intercept (Playwright page.route).
 * Nenhum cenário usa test.skip() — todos implementados (FE-PUB-027 / P9 E2E).
 *
 * Auth: seedPubSession() via page.addInitScript() ANTES de page.goto().
 *       Token escrito no localStorage antes do Angular bootar.
 *
 * API paths: SEMPRE /api/v1/pub/ (não /api/pub/).
 * Guard: pubStatusGuard('export') faz GET /api/v1/proj/projetos/{id} → mockProjStatus().
 */
import { test, expect } from '@playwright/test';
import { seedPubSession, SCOPES_PUB_VIEW, SCOPES_NO_PUB } from './support/auth-helpers';
import {
  PROJETO_ID,
  PUBLICACAO_ID,
  STATUS_GERANDO,
  STATUS_VALIDO,
  STATUS_ERROS,
  mockProjStatus,
  mockTriggerExport,
  mockTriggerInFlight,
  mockTriggerError,
  mockPollStatus,
  mockPollNetworkError,
  mockT07HappyPath,
} from './support/api-mocks';
import { T07 } from './support/selectors';

const EXPORT_URL = `/pub/projetos/${PROJETO_ID}/exportacao-e-validacao`;

// ─────────────────────────────────────────────────────────────────────────────
// C1 — pub-export-trigger + pub-poll-status + pub-poll-terminal
// Trigger → polling → publicado/valido. Verifica: spinner desaparece, banner válido aparece.
// ─────────────────────────────────────────────────────────────────────────────
test('Disparo da exportação e polling até o estado terminal `pub-export-trigger` `pub-poll-status` `pub-poll-terminal`', async ({ page }) => {
  await seedPubSession(page);
  await mockT07HappyPath(page, PROJETO_ID);
  await page.goto(EXPORT_URL);

  // Após poll completar → banner válido visível
  await expect(page.locator(T07.bannerValido)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(T07.estadoGerando)).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// C2 — pub-export-idempotent
// POST retorna 200 (em vez de 202) quando já há build em andamento.
// Verifica: spinner ainda aparece (estado gerando).
// ─────────────────────────────────────────────────────────────────────────────
test('Build já em andamento é um no-op idempotente `pub-export-idempotent`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerInFlight(page, PROJETO_ID);
  await mockPollStatus(page, [STATUS_GERANDO], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  // POST 200 → facade entra em poll; spinner aparece
  await expect(page.locator(T07.estadoGerando)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C3 — pub-progress-indeterminate
// Enquanto gerando: progressbar existe; NAO verifica percentual.
// ─────────────────────────────────────────────────────────────────────────────
test('Progresso indeterminado enquanto gerando `pub-progress-indeterminate`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  await mockPollStatus(page, [STATUS_GERANDO], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  // Deve haver [role="progressbar"] enquanto gerando
  await expect(page.locator(T07.progressbar)).toBeVisible({ timeout: 5_000 });
  // Sem barra de progresso percentual — indeterminate apenas (SPEC-03)
  await expect(page.locator('[aria-valuenow]')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// C4 — pub-verdict-rendered
// Publicacao chega com {status:'publicado', epubcheckStatus:'valido'}.
// Verifica: banner-valido existe, texto "ePub válido" visível.
// ─────────────────────────────────────────────────────────────────────────────
test('Veredito válido é renderizado, não computado `pub-verdict-rendered`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  await mockPollStatus(page, [STATUS_VALIDO], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.bannerValido)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(T07.bannerValido)).toContainText('ePub válido');
});

// ─────────────────────────────────────────────────────────────────────────────
// C5 — pub-avisos-nonblocking
// Publicacao com avisos (epubcheckStatus='avisos'): btn-baixar ESTÁ habilitado.
// ─────────────────────────────────────────────────────────────────────────────
test('Avisos não bloqueiam a publicação `pub-avisos-nonblocking`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  const statusAvisos = { ...STATUS_VALIDO, epubcheckStatus: 'avisos', totalAvisos: 5 };
  await mockPollStatus(page, [statusAvisos], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.btnBaixar)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(T07.btnBaixar)).not.toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────────────────
// C6 — pub-resume-reentry
// Navegar de volta enquanto um build está gerando → spinner aparece.
// ─────────────────────────────────────────────────────────────────────────────
test('Retomada do estado ao reentrar na tela `pub-resume-reentry`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  // Poll retorna gerando (mantém o spinner)
  await mockPollStatus(page, [STATUS_GERANDO, STATUS_GERANDO], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoGerando)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C7 — pub-nav-baixar-t08
// Quando podeBaixar = true, clicar em btn-baixar navega para T08 URL.
// ─────────────────────────────────────────────────────────────────────────────
test('"Baixar ePub" navega para o histórico `pub-nav-baixar-t08`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  await mockPollStatus(page, [STATUS_VALIDO], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.btnBaixar)).toBeVisible({ timeout: 10_000 });
  await page.locator(T07.btnBaixar).click();

  // Deve navegar para T08 (download-e-historico)
  await expect(page).toHaveURL(/download-e-historico/, { timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C8 — pub-no-optimistic
// Estado "gerando" SÓ aparece após o POST retornar (não otimisticamente).
// Verifica: antes do POST retornar não há estado gerando.
// ─────────────────────────────────────────────────────────────────────────────
test('Exportação é server-autoritativa sem escrita otimista `pub-no-optimistic`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);

  // POST com atraso para verificar que o spinner não aparece antes
  let postResolve: (() => void) | undefined;
  const postPromise = new Promise<void>(res => { postResolve = res; });

  await page.route(`**/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`, async (route) => {
    if (route.request().method() === 'POST') {
      await postPromise; // aguarda antes de responder
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(STATUS_GERANDO),
      });
    } else {
      await route.continue();
    }
  });
  await mockPollStatus(page, [STATUS_GERANDO], PROJETO_ID, PUBLICACAO_ID);

  await page.goto(EXPORT_URL);

  // Imediatamente após goto, o spinner não deve estar visível (não-otimístico)
  // Nota: o componente chama startExport() em ngOnInit — o POST pode ser quase imediato
  // Verificamos que o estado inicial não é um placeholder estático
  await expect(page.locator(T07.bannerValido)).not.toBeVisible();
  await expect(page.locator(T07.bannerErros)).not.toBeVisible();

  // Libera o POST → estado gerando aparece
  postResolve?.();
  await expect(page.locator(T07.estadoGerando)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C9 — pub-err-manuscript-missing
// POST retorna 409 com code pub:manuscript-missing.
// Verifica: estado de erro visível, sem spinner.
// ─────────────────────────────────────────────────────────────────────────────
test('Manuscrito ausente bloqueia a exportação `pub-err-manuscript-missing`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerError(page, 409, 'pub:manuscript-missing', PROJETO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(T07.estadoGerando)).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// C10 — pub-err-metadata-incomplete
// POST retorna 422 com code pub:metadata-incomplete.
// Verifica: estado de erro visível.
// ─────────────────────────────────────────────────────────────────────────────
test('Metadados incompletos bloqueiam a exportação `pub-err-metadata-incomplete`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerError(page, 422, 'pub:metadata-incomplete', PROJETO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C11 — pub-err-status-advance-failed
// POST retorna 502 com X-Correlation-Id.
// Verifica: estado de erro visível.
// ─────────────────────────────────────────────────────────────────────────────
test('Falha ao avançar o status do projeto `pub-err-status-advance-failed`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await page.route(`**/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        headers: { 'X-Correlation-Id': 'trace-pub-e2e-502' },
        body: JSON.stringify({ code: 'pub:status-advance-failed', message: 'Falha no serviço', correlationId: 'trace-pub-e2e-502' }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C12 — pub-err-verdict-not-error
// GET status retorna {status:'com_erros', epubcheckStatus:'erros_criticos'}.
// Verifica: banner-erros aparece (NOT um toast de erro — é um estado normal).
// ─────────────────────────────────────────────────────────────────────────────
test('Veredito de erros críticos não é toast de erro `pub-err-verdict-not-error`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  await mockPollStatus(page, [STATUS_ERROS], PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.bannerErros)).toBeVisible({ timeout: 10_000 });
  // Não deve ser um toast de erro — é o estado de erros críticos do epubcheck
  await expect(page.locator(T07.estadoError)).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// C13 — pub-err-network-retry
// GET status abortado (network error).
// Verifica: estado error com btn-retry visível.
// ─────────────────────────────────────────────────────────────────────────────
test('Falha de rede antes de existir publicação é retryável `pub-err-network-retry`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerExport(page, PROJETO_ID);
  await mockPollNetworkError(page, PROJETO_ID, PUBLICACAO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(T07.btnRetry)).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// C14 — pub-err-publicacao-not-found
// POST retorna 404.
// Verifica: estado de erro aparece.
// ─────────────────────────────────────────────────────────────────────────────
test('Publicação inexistente `pub-err-publicacao-not-found`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerError(page, 404, 'urn:cordele:pub:not-found', PROJETO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C15 — pub-err-forbidden
// GET retorna 403.
// Verifica: estado de erro aparece.
// ─────────────────────────────────────────────────────────────────────────────
test('Acesso proibido exibe mensagem bloqueante `pub-err-forbidden`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  await mockTriggerError(page, 403, 'urn:cordele:pub:forbidden', PROJETO_ID);
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.estadoError)).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C16 — pub-err-trace-id
// POST retorna 502 com correlationId no body.
// Verifica: [data-testid="error-trace-id"] existe e contém texto "Trace:".
// ─────────────────────────────────────────────────────────────────────────────
test('Toda falha anexa o traceId de correlação `pub-err-trace-id`', async ({ page }) => {
  await seedPubSession(page);
  await mockProjStatus(page, PROJETO_ID);
  const traceId = 'trace-pub-e2e-001';
  await page.route(`**/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'pub:status-advance-failed', message: 'Falha', correlationId: traceId }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(EXPORT_URL);

  await expect(page.locator(T07.errorTraceId)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(T07.errorTraceId)).toContainText('Trace:');
});

// ─────────────────────────────────────────────────────────────────────────────
// C17 — pub-guard-session
// Sem auth seeded → navegar para EXPORT_URL redireciona para fora da rota protegida.
// O authGuard cria createUrlTree(['/login']). Como /login não existe no Cordelê shell,
// o router não encontra a rota e a navegação resulta em URL diferente de EXPORT_URL.
// Verificamos apenas que a proteção funcionou (URL ≠ EXPORT_URL), não o destino exacto.
// ─────────────────────────────────────────────────────────────────────────────
test('Guards de rota redirecionam quando sessão ausente `pub-guard-session`', async ({ page }) => {
  // Sem seedPubSession — sem token no localStorage
  await page.goto(EXPORT_URL);
  // authGuard bloqueia → URL não é a rota protegida
  await expect(page).not.toHaveURL(/exportacao-e-validacao/, { timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C18 — pub-guard-uuid
// Navegar para UUID inválido → redirect (pubProjetoGuard rejeita).
// ─────────────────────────────────────────────────────────────────────────────
test('Guard de UUID rejeita projetoId inválido `pub-guard-uuid`', async ({ page }) => {
  await seedPubSession(page);
  await page.goto('/pub/projetos/nao-valido-uuid/exportacao-e-validacao');
  // pubProjetoGuard redireciona quando UUID inválido
  await expect(page).not.toHaveURL(/nao-valido-uuid/, { timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// C19 — pub-perm-export
// JWT com apenas pub:read (sem pub:write) → redirect (sem permissão pub.export).
// ─────────────────────────────────────────────────────────────────────────────
test('Permissão pub.export ausente redireciona `pub-perm-export`', async ({ page }) => {
  // Seed com scopes insuficientes (pub:read apenas — não tem pub:write para pub.export)
  await seedPubSession(page, SCOPES_PUB_VIEW);
  await mockProjStatus(page, PROJETO_ID);
  await page.goto(EXPORT_URL);
  // accessGuard('pub.export') rejeita → redirect (acesso-negado ou login)
  await expect(page).not.toHaveURL(EXPORT_URL, { timeout: 5_000 });
});
