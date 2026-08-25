/**
 * E2E spec: Baixar o ePub e navegar pelo histórico de exportações
 * Feature: frontend/e2e/download-e-historico.feature
 * 7 scenarios (BDD -> Playwright stubs)
 * Gate: A5 e2e-validate (structural). Prototype-first (D-484), registered by
 * fe-nx-register-module.py (D-487).
 * TODO[FE-PUB-P9]: implement with real selectors after fe-implement.
 */
import { test, expect } from '@playwright/test';

test.describe('Baixar o ePub e navegar pelo histórico de exportações', () => {
  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Histórico mais recente primeiro com a versão atual marcada `pub-versao-atual`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('KPIs vêm do endpoint de stats `pub-stats-live`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Tile de resumo do ePub ausente é omitido `pub-kpi-omit-missing`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Download de publicação válida via URL assinada `pub-download-signed-url`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Gate de download bloqueia publicações inválidas `pub-gate-download`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Link de download expirado é renovado `pub-download-expired-refetch`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

  // TODO[FE-PUB-P9]: implement assertions for this scenario
  test.skip('Artefato indisponível exibe erro inline `pub-err-artifact-not-available`', async ({ page }) => {
    await page.goto('/pub');
    await expect(page).toHaveURL(/.*/);
  });

});
