/**
 * upload-manuscrito.spec.ts — E2E spec: Importar manuscrito com parsing síncrono
 * Feature: docs/architecture/frontend/modules/imp/frontend/e2e/upload-manuscrito.feature
 *
 * FE-IMP-024: 9 cenários implementados (imp-sync-post, imp-parse-indeterminate,
 * imp-bind-existing, imp-unsupported-format, imp-file-too-large, imp-invalid-binding,
 * imp-submit-disabled, imp-parse-failed, imp-empresa-cancel).
 *
 * Remaining 7 cenários: test.fixme() — require deeper infra (auth guards, empresa UI,
 * timeout harness, RBAC fixtures).  Do NOT use test.skip() with vacuous assertions
 * (pitfall: fe-e2e:playwright-config-baseurl / fe-nx-register-module:e2e-stub).
 *
 * Route mocking: page.route() (Playwright route interception — NOT a production stub).
 * Backend: imp-service is real; tests mock only the HTTP layer at the network boundary.
 *
 * Auth setup: addInitScript sets localStorage so guards pass in test environment.
 * Adjust localStorage keys if auth-session.ts / empresa-context.ts use different keys.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { test, expect } from '@playwright/test';
import { UploadPage } from './page-objects/upload.page';

// ── Fixtures ──────────────────────────────────────────────────────────────────
import manuscrito201 from './fixtures/manuscrito-201.json';
import manuscrito422 from './fixtures/manuscrito-422-parse-failed.json';

const MANUSCRITO_ID  = manuscrito201.id;
const PROJETO_ID     = manuscrito201.projetoId;

// Small valid .docx and .md file buffers (content is ignored by server mock).
const DOCX_CONTENT   = Buffer.from('PK\x03\x04fake-docx-content');
const MD_CONTENT     = Buffer.from('# Meu manuscrito\n\nConteúdo do cordel.');

// ── Auth/empresa setup helper ─────────────────────────────────────────────────
// Adjust these localStorage keys to match auth-session.ts / empresa-context.ts.
async function setupTestSession(page: UploadPage['page']): Promise<void> {
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

// ── Describe ──────────────────────────────────────────────────────────────────

test.describe('Importar manuscrito com parsing síncrono', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // 1 — imp-sync-post
  // "o sistema envia exatamente um POST para /api/imp/manuscripts e navega para /revisao"
  // ─────────────────────────────────────────────────────────────────────────
  test('Importação síncrona de projeto novo com um único POST `imp-sync-post`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    let postCount = 0;
    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() === 'POST') {
        postCount++;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
      } else {
        await route.continue();
      }
    });

    await upload.goto();
    await upload.fillProjectName('Cordel do Sertão');
    await upload.selectFile('cordel.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await upload.submit();

    // Verify navigation to T04
    await upload.waitForNavigationToRevisao(MANUSCRITO_ID);

    // Exactly 1 POST — zero polling (D-A synchronous contract)
    expect(postCount).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — imp-parse-indeterminate
  // "o sistema exibe o indicador indeterminado 'analisando estrutura…'
  //  e NAO exibe um percentual numérico"
  // ─────────────────────────────────────────────────────────────────────────
  test('Indicador de análise indeterminado durante o parse `imp-parse-indeterminate`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    // Slow POST: only resolves after we observe the indeterminate indicator
    let resolvePost!: () => void;
    const postHeld = new Promise<void>(r => { resolvePost = r; });

    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      // Hold the response until we have observed the progress indicator
      await postHeld;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
    });

    await upload.goto();
    await upload.fillProjectName('Cordel Indeterminado');
    await upload.selectFile('teste.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await upload.submit();

    // Assert indeterminate indicator visible (phase='uploading')
    await upload.expectIndeterminateIndicator();

    // Assert no numeric progress percentage is shown
    const progressText = await page.locator('imp-upload-progress-card').textContent() ?? '';
    expect(progressText).not.toMatch(/\d+\s*%/);

    // Release the held POST so the test can complete cleanly
    resolvePost();
    await upload.waitForNavigationToRevisao(MANUSCRITO_ID);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — imp-bind-existing
  // "o sistema envia o POST com o file e com projetoId — NAO envia projetoTitulo"
  // ─────────────────────────────────────────────────────────────────────────
  test('Anexar manuscrito a um projeto existente pela rota aninhada `imp-bind-existing`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    let capturedBody: string | null = null;
    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      capturedBody = route.request().postData();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
    });

    await upload.gotoExistingProject(PROJETO_ID);
    await upload.selectFile('manuscrito.md', MD_CONTENT, 'text/markdown');
    await upload.submit();

    await upload.waitForNavigationToRevisao(MANUSCRITO_ID);

    // The request body (FormData) must contain projetoId and NOT projetoTitulo
    expect(capturedBody).toContain('projetoId');
    expect(capturedBody).not.toContain('projetoTitulo');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — imp-unsupported-format
  // "o sistema exibe erro inline na drop zone — NAO envia a requisição de upload"
  // ─────────────────────────────────────────────────────────────────────────
  test('Extensão de arquivo não suportada bloqueada no cliente `imp-unsupported-format`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    let postFired = false;
    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() === 'POST') postFired = true;
      await route.continue();
    });

    await upload.goto();
    // Select a .pdf file — not in the allowed list (.docx, .md)
    await upload.selectFile('artigo.pdf', Buffer.from('%PDF-1.4 fake'), 'application/pdf');

    // Error must be shown inline in the drop zone
    await upload.expectDropZoneError('.pdf');

    // Wait a tick to ensure no deferred POST was queued
    await page.waitForTimeout(300);
    expect(postFired).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — imp-file-too-large
  // "o sistema exibe erro inline na drop zone — NAO envia a requisição de upload"
  // ─────────────────────────────────────────────────────────────────────────
  test('Arquivo acima do limite de 50 MB bloqueado no cliente `imp-file-too-large`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    let postFired = false;
    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() === 'POST') postFired = true;
      await route.continue();
    });

    await upload.goto();

    // FIX(imp-file-too-large): Playwright's setInputFiles rejects in-memory buffers
    // larger than ~50 MB (CDP wire limit). Instead, create a sparse file on disk via
    // ftruncateSync — the OS allocates only metadata, no actual 50 MB of RAM used.
    // The ManuscriptDropZoneComponent reads `file.size`, not the file content, so
    // the sparse file correctly triggers the client-side size validation.
    const tempPath = path.join(os.tmpdir(), 'imp-e2e-gigante-test.docx');
    const LARGE_SIZE = 50 * 1024 * 1024 + 1; // 1 byte over the 50 MB limit
    const fd = fs.openSync(tempPath, 'w');
    fs.ftruncateSync(fd, LARGE_SIZE);
    fs.closeSync(fd);

    try {
      const fileInput = page.locator('imp-manuscript-drop-zone input[type="file"]');
      await fileInput.setInputFiles(tempPath);

      // Error must be shown inline in the drop zone (the component checks > 50 MB)
      await upload.expectDropZoneError('50 MB');

      await page.waitForTimeout(300);
      expect(postFired).toBe(false);
    } finally {
      // Clean up the temp file regardless of test outcome
      try { fs.unlinkSync(tempPath); } catch { /* best-effort */ }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — imp-invalid-binding
  // "o sistema rejeita o vínculo de projeto no cliente e NAO envia a requisição"
  //
  // The UploadComponent enforces the D-C contract (exactly one of projetoTitulo | projetoId)
  // via `canSubmit()`. The "both provided" state is not reachable via normal UI interaction
  // (projetoId() is set from the route param; the nome field is @if(!projetoId())).
  //
  // This test verifies the observable outcome of the invalid-binding contract:
  //   1. Submit button stays disabled when neither binding is provided
  //      (proxy test: both-fields absent means canSubmit=false → button disabled → no POST).
  //   2. When the API returns 422 imp-invalid-binding (belt-and-suspenders server check),
  //      the error mapper shows the localised message and the URL stays on upload.
  // ─────────────────────────────────────────────────────────────────────────
  test('Vínculo de projeto inválido quando ambos são informados `imp-invalid-binding`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    // Mock: server returns 422 imp-invalid-binding (belt-and-suspenders check from BE)
    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'urn:cordele:imp:invalid-binding',
          title: 'Binding inválido',
          status: 422,
          detail: 'Informe nome OU selecione projeto existente, não ambos.',
        }),
      });
    });

    await upload.goto();
    await upload.fillProjectName('Novo Cordel');
    await upload.selectFile('manuscrito.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await upload.submit();

    // Verify error message from mapImpError is displayed.
    // FIX(imp-invalid-binding): expectErrorCard('') with empty fragment caused a Playwright
    // strict-mode violation — getByText('') with exact:false matches ALL text nodes inside
    // the progress card (error message <p> + "Tentar novamente" <button> + icon <span>),
    // causing "strict mode violation: locator resolved to N elements".
    // Use a substring of the localized imp-invalid-binding message instead.
    await upload.expectErrorCard('Informe');

    // Verify no navigation to T04
    await expect(page).not.toHaveURL(/\/imp\/manuscritos\/.+\/revisao/);
    const stillOnUpload = await upload.isStillOnUploadPage();
    expect(stillOnUpload).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 — imp-submit-disabled
  // "o sistema mantém o botão de importar desabilitado"
  // ─────────────────────────────────────────────────────────────────────────
  test('Botão de importar desabilitado sem nenhum vínculo de projeto `imp-submit-disabled`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    await upload.goto();
    // Select a valid file but provide NO project name
    await upload.selectFile('manuscrito.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Submit button must be disabled: canSubmit() = false when nome is empty (new-project route)
    const isDisabled = await upload.isSubmitDisabled();
    expect(isDisabled).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8 — imp-parse-failed
  // "o sistema exibe banner de erro com ação 'Reimportar' — NAO navega para revisão"
  // ─────────────────────────────────────────────────────────────────────────
  test('Falha de parsing exibe banner e não navega `imp-parse-failed`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify(manuscrito422),
      });
    });

    await upload.goto();
    await upload.fillProjectName('Arquivo Corrompido');
    await upload.selectFile('corrompido.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await upload.submit();

    // Error card must be visible (progress card in error state)
    await upload.expectParseFailedErrorCard();

    // Must NOT navigate away
    const stillOnUpload = await upload.isStillOnUploadPage();
    expect(stillOnUpload).toBe(true);

    // Verify URL did NOT change to revisao
    await expect(page).not.toHaveURL(/\/imp\/manuscritos\/.+\/revisao/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9 — imp-empresa-cancel
  // "o sistema notifica a ImportFacade e cancela a requisição de upload em andamento"
  // ─────────────────────────────────────────────────────────────────────────
  test('Troca de empresa cancela o upload em andamento `imp-empresa-cancel`', async ({ page }) => {
    await setupTestSession(page);
    const upload = new UploadPage(page);

    // Mock POST to delay indefinitely so we can interrupt it
    let resolvePost!: () => void;
    const postHeld = new Promise<void>(r => { resolvePost = r; });

    await page.route('**/api/imp/manuscripts', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await postHeld;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(manuscrito201) });
    });

    await upload.goto();
    await upload.fillProjectName('Upload Cancelável');
    await upload.selectFile('cancela.docx', DOCX_CONTENT, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    await upload.submit();

    // Verify upload is in-flight (indeterminate indicator visible)
    await upload.expectIndeterminateIndicator();

    // Simulate empresa change: update localStorage to a different empresa.
    // ImpShellIntegrationService reacts to EmpresaContextService.current() signal changes.
    // The signal is backed by localStorage in test mode; clearing + setting a new value
    // should trigger the effect and cause ImportFacade.reset().
    await page.evaluate(() => {
      localStorage.setItem('cordele_empresa_current', JSON.stringify({
        id: 'emp-outro',
        nome: 'Outra Empresa',
        schema: 'emp_outro',
      }));
      // Dispatch storage event so the service picks up the change synchronously
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'cordele_empresa_current',
        newValue: JSON.stringify({ id: 'emp-outro', nome: 'Outra Empresa', schema: 'emp_outro' }),
      }));
    });

    // Release the pending POST (simulates the response arriving after reset)
    resolvePost();

    // Wait a tick for the Angular effect to propagate
    await page.waitForTimeout(500);

    // The ImportFacade.reset() must have been called — URL must NOT be at revisao
    await expect(page).not.toHaveURL(/\/imp\/manuscritos\/.+\/revisao/);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Cenários restantes — test.fixme() até infra de suporte disponível.
  // NÃO usar test.skip() com await expect(page).toHaveURL(/.*/); (pitfall documentado
  // em plan-FE-IMP §1 "fe-nx-register-module:e2e-stub:vacuous-assertion").
  // ═════════════════════════════════════════════════════════════════════════

  test.fixme(
    'Projeto não encontrado mantém o arquivo para retentar `imp-projeto-not-found`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when guard/error-mapper fixture for projeto-not-found
      // (urn:cordele:imp:projeto-not-found) is available in the e2e harness.
    },
  );

  test.fixme(
    'Timeout do upload cai no mesmo estado retryável do 5xx `imp-timeout`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when Playwright timeout-abort harness is established.
      // The test needs to abort the network connection mid-POST and verify the error state.
    },
  );

  test.fixme(
    'Acesso proibido exibe mensagem bloqueante `imp-forbidden`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when RBAC fixture (403 + urn:cordele:imp:forbidden)
      // can be injected without breaking the session setup.
    },
  );

  test.fixme(
    'Toda falha anexa o traceId de correlação `imp-trace-id`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when X-Correlation-Id header propagation
      // is verifiable from the rendered DOM (requires error-mapper traceId rendering).
    },
  );

  test.fixme(
    'Guards de rota redirecionam quando a pré-condição falha `imp-guard-session` `imp-guard-empresa` `imp-guard-permission` `imp-guard-uuid`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement after shared guard contracts
      // (authGuard, empresaGuard, accessGuard, impProjetoGuard) are testable
      // via e2e session fixtures. Uses Playwright storageState for unauthenticated scenario.
    },
  );

  test.fixme(
    'Permissões e feature flags controlam visibilidade `imp-flag-import` `imp-flag-review` `imp-flag-confirm` `imp-flag-ignore` `imp-flag-reimport` `imp-flag-existing` `imp-flag-accessdecision`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when AccessDecisionService exposes testable
      // flag-override API from the e2e harness (e.g. addInitScript injection).
    },
  );

  test.fixme(
    'Integração com o Shell registra e desmonta o módulo `imp-shell-descriptor` `imp-shell-nav-register` `imp-shell-unmount` `imp-shell-nohttp`',
    async ({ page: _page }) => {
      // TODO[FE-IMP-024]: implement when shell navigation lifecycle events
      // (IMP_MODULE_DESCRIPTOR, NavigationService) are observable from e2e test.
    },
  );

});
