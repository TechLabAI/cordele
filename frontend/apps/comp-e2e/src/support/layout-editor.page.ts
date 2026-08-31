/**
 * layout-editor.page.ts — Page Object for T06 Editor de Layout / Preview.
 *
 * Provides semantic selectors and action helpers for
 * `editor-de-layout-preview.spec.ts`.
 * Selectors are based on the component template
 * (editor-de-layout-preview.component.ts) and its child components.
 *
 * FE-COMP-027 (P10 E2E gate) / SPEC-08 §2.
 */
import { type Page, type Locator, expect } from '@playwright/test';
import { PROJETO_ID } from './api-mocks';

export class LayoutEditorPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async goto(projetoId = PROJETO_ID): Promise<void> {
    await this.page.goto(`/comp/projetos/${projetoId}/editor-de-layout-preview`);
  }

  // ── Host component ─────────────────────────────────────────────────────────

  get host(): Locator {
    return this.page.locator('comp-editor-de-layout-preview');
  }

  // ── Top-bar area ────────────────────────────────────────────────────────────

  get stepBar(): Locator {
    return this.page.locator('comp-step-bar');
  }

  get breadcrumbNav(): Locator {
    return this.page.getByRole('navigation', { name: 'Localização' });
  }

  // ── Export bar ─────────────────────────────────────────────────────────────

  get exportBar(): Locator {
    return this.page.locator('comp-export-bar');
  }

  get exportButton(): Locator {
    return this.exportBar.getByRole('button', { name: /Exportar/i });
  }

  // ── Style panel (always visible) ───────────────────────────────────────────

  get stylePanel(): Locator {
    return this.page.locator('comp-style-panel');
  }

  /** Slider/input for "Tamanho da fonte" (fonteCorpoTamanho). */
  get fontSizeSlider(): Locator {
    return this.stylePanel.locator('input[type="range"]').first();
  }

  /** Select for "Fonte do corpo" (fonteCorpoFamilia). */
  get fontFamilySelect(): Locator {
    return this.stylePanel.locator('select').first();
  }

  // ── Preview canvas ─────────────────────────────────────────────────────────

  get previewCanvas(): Locator {
    return this.page.locator('comp-preview-canvas');
  }

  // ── Paginator ──────────────────────────────────────────────────────────────

  get paginator(): Locator {
    return this.page.locator('comp-page-paginator');
  }

  get nextPageButton(): Locator {
    return this.paginator.getByRole('button', { name: /próxim|next|avançar/i });
  }

  get prevPageButton(): Locator {
    return this.paginator.getByRole('button', { name: /anterior|prev|voltar/i });
  }

  // ── Loading / skeleton ─────────────────────────────────────────────────────

  get skeleton(): Locator {
    return this.page.locator('comp-preview-skeleton');
  }

  // ── Empty state (409 manuscript-missing) ───────────────────────────────────

  get emptyState(): Locator {
    return this.page.locator('comp-preview-empty');
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  get errorState(): Locator {
    return this.page.locator('comp-error-state');
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  get toast(): Locator {
    return this.page.getByRole('alert');
  }

  // ── Structural toolbar (MUST NOT exist — ADR-COMP-001 / D-H) ──────────────

  get addPageButton(): Locator {
    return this.page.getByRole('button', { name: /adicionar página/i });
  }

  get insertImageButton(): Locator {
    return this.page.getByRole('button', { name: /inserir imagem/i });
  }

  get removePageButton(): Locator {
    return this.page.getByRole('button', { name: /remover página/i });
  }

  // ── Image alignment badge ─────────────────────────────────────────────────

  get imageAlignmentBadge(): Locator {
    return this.page.locator('comp-image-alignment-badge');
  }

  // ── Assertions ──────────────────────────────────────────────────────────────

  /** Waits for the canvas to be in a ready state (not loading). */
  async waitForReady(): Promise<void> {
    await expect(this.skeleton).not.toBeVisible({ timeout: 10_000 });
    await expect(this.errorState).not.toBeVisible();
    await expect(this.emptyState).not.toBeVisible();
    await expect(this.previewCanvas).toBeVisible();
  }

  /** Asserts that no structural toolbar buttons are present. */
  async expectNoStructuralToolbar(): Promise<void> {
    await expect(this.addPageButton).toHaveCount(0);
    await expect(this.insertImageButton).toHaveCount(0);
    await expect(this.removePageButton).toHaveCount(0);
  }

  /** Asserts that the export button is enabled. */
  async expectExportEnabled(): Promise<void> {
    await expect(this.exportButton).toBeEnabled();
  }

  /** Clicks Exportar and waits for navigation or response. */
  async clickExport(): Promise<void> {
    await this.exportButton.click();
  }
}
