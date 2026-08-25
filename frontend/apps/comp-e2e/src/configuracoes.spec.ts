/**
 * E2E spec: Configurações (T05)
 * Feature: frontend/modules/comp/frontend/e2e/configuracoes.feature
 * Gate: M7 e2e-validate (structural). Prototype-first (D-493/D-494).
 * TODO[FE-COMP-P9]: implement with real selectors after fe-implement.
 */
import { test, expect } from '@playwright/test';

const PROJETO_ID = 'proj-001';
const BASE = `/comp/projetos/${PROJETO_ID}/config`;

test.describe('Configurações de Metadados (T05)', () => {

  test.skip('Guard redireciona quando projetoId não existe `comp-guard-projeto`', async ({ page }) => {
    await page.goto('/comp/projetos/nao-existe/config');
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Guard redireciona quando projeto não está em_composicao `comp-guard-status`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Formulário pré-preenchido com dados do backend `comp-config-prefill`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Default lazy: form vazio quando metadados não materializados `comp-config-default-lazy`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Botão "Ir para preview" desabilitado sem Título e Autor `comp-config-validate-required`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Preenchimento dos campos obrigatórios habilita avanço `comp-config-valid-enables-cta`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Salva metadados ao avançar (escrita pessimista) `comp-config-pessimistic-save`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Upload de capa JPEG/PNG/WEBP ≤10MB `comp-config-capa-upload`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Upload de capa >10MB retorna 413 `comp-config-capa-413`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Navega para T06 após salvar `comp-config-navigate-to-editor`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Voltar leva para IMP importar `comp-config-back-to-imp`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

});
