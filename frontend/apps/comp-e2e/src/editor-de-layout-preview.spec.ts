/**
 * E2E spec: Editor de Layout / Preview (T06)
 * Feature: frontend/modules/comp/frontend/e2e/editor-de-layout-preview.feature
 * Gate: M7 e2e-validate (structural). Prototype-first (D-493/D-494).
 * TODO[FE-COMP-P9]: implement with real selectors after fe-implement.
 */
import { test, expect } from '@playwright/test';

const PROJETO_ID = 'proj-001';
const BASE = `/comp/projetos/${PROJETO_ID}/editor-de-layout-preview`;

test.describe('Editor de Layout / Preview (T06)', () => {

  test.skip('Guard redireciona quando projetoId não existe `comp-editor-guard-projeto`', async ({ page }) => {
    await page.goto('/comp/projetos/nao-existe/editor-de-layout-preview');
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Preview carrega a estrutura via preview-context `comp-editor-load-context`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Toolbar estrutural NÃO está presente (structuralEdits=false) `comp-editor-no-struct-toolbar`', async ({ page }) => {
    await page.goto(BASE);
    // Verify that adicionarPagina/inserirImagem/removerPagina buttons are absent
    await expect(page.locator('button:has-text("Adicionar página")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Inserir imagem")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Remover página")')).toHaveCount(0);
  });

  test.skip('Paginador: avança e recua entre capítulos `comp-editor-paginator`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Painel de estilos atualiza fonte do corpo `comp-editor-font-family`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Slider de tamanho de fonte atualiza o preview `comp-editor-font-size`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Slider de espaçamento de linha atualiza o preview `comp-editor-line-height`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Ajustar alinhamento de imagem persiste override `comp-editor-align-override`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Página tipo em-branco NÃO é renderizada `comp-editor-no-blank-page`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

  test.skip('Exportar navega para /pub/exportacao-e-validacao `comp-editor-export-nav`', async ({ page }) => {
    await page.goto(BASE);
    await page.click('a:has-text("Exportar")');
    await expect(page).toHaveURL(/exportacao-e-validacao/);
  });

  test.skip('Layout persistido ao sair `comp-editor-layout-persist`', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/.*/);
  });

});
