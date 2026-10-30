/**
 * comp-config.page.ts — Page Object for T05 Configurações de Metadados.
 *
 * Provides semantic selectors and action helpers for `configuracoes.spec.ts`.
 * Selectors are based on the component's template (configuracoes.component.ts)
 * and its child presentational components.
 *
 * FE-COMP-026 (P10 E2E gate) / SPEC-08 §1.
 */
import { type Page, type Locator, expect } from '@playwright/test';
import { PROJETO_ID } from './api-mocks';

export class CompConfigPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async goto(projetoId = PROJETO_ID): Promise<void> {
    await this.page.goto(`/comp/projetos/${projetoId}/config`);
  }

  // ── Host component ─────────────────────────────────────────────────────────

  get host(): Locator {
    return this.page.locator('comp-configuracoes');
  }

  // ── Step bar ───────────────────────────────────────────────────────────────

  get stepBar(): Locator {
    return this.page.locator('comp-step-bar');
  }

  // ── Breadcrumb ─────────────────────────────────────────────────────────────

  get breadcrumbNav(): Locator {
    return this.page.getByRole('navigation', { name: 'Localização' });
  }

  // ── Skeleton / Loading ──────────────────────────────────────────────────────

  get skeleton(): Locator {
    return this.page.locator('comp-metadata-skeleton');
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  get errorState(): Locator {
    return this.page.locator('comp-error-state');
  }

  get retryButton(): Locator {
    return this.errorState.getByRole('button');
  }

  // ── Form fields ─────────────────────────────────────────────────────────────

  get tituloInput(): Locator {
    // comp-metadata-field for "Título" — selects the internal <input>
    return this.page.locator('comp-metadata-field').filter({ hasText: 'Título' }).getByRole('textbox');
  }

  get autorInput(): Locator {
    return this.page.locator('comp-metadata-field').filter({ hasText: 'Autor' }).getByRole('textbox');
  }

  get isbnInput(): Locator {
    return this.page.locator('comp-metadata-field').filter({ hasText: 'ISBN' }).getByRole('textbox');
  }

  get categoriaInput(): Locator {
    return this.page.locator('comp-metadata-field').filter({ hasText: 'Categoria' }).getByRole('textbox');
  }

  get idiomaSelect(): Locator {
    return this.page.locator('comp-idioma-select');
  }

  // ── Cover drop zone ─────────────────────────────────────────────────────────

  get coverDropZone(): Locator {
    return this.page.locator('comp-cover-drop-zone');
  }

  // ── Advance bar ─────────────────────────────────────────────────────────────

  get advanceBar(): Locator {
    return this.page.locator('comp-advance-bar');
  }

  get avancarButton(): Locator {
    return this.advanceBar.getByRole('button', { name: /Ir para preview/i });
  }

  // ── Back link ───────────────────────────────────────────────────────────────

  get voltarLink(): Locator {
    return this.page.getByRole('link', { name: /Voltar/i });
  }

  // ── Validation / toast ──────────────────────────────────────────────────────

  get validationAlert(): Locator {
    return this.page.getByRole('alert');
  }

  // ── Assertions ──────────────────────────────────────────────────────────────

  /** Waits for the form to be in a ready state (not loading, not error). */
  async waitForReady(): Promise<void> {
    await expect(this.skeleton).not.toBeVisible({ timeout: 10_000 });
    await expect(this.errorState).not.toBeVisible();
    await expect(this.tituloInput).toBeVisible();
  }

  /** Fills the required fields with valid data. */
  async fillRequired(titulo = 'Meu Livro', autor = 'João Silva'): Promise<void> {
    await this.tituloInput.fill(titulo);
    await this.autorInput.fill(autor);
  }

  /** Clears required fields to produce a validation error. */
  async clearRequired(): Promise<void> {
    await this.tituloInput.clear();
    await this.autorInput.clear();
  }

  /** Asserts that the "Ir para preview" button is disabled. */
  async expectAvancarDisabled(): Promise<void> {
    await expect(this.avancarButton).toBeDisabled();
  }

  /** Asserts that the "Ir para preview" button is enabled. */
  async expectAvancarEnabled(): Promise<void> {
    await expect(this.avancarButton).toBeEnabled();
  }

  /** Clicks Ir para preview and waits for navigation. */
  async clickAvancar(): Promise<void> {
    await this.avancarButton.click();
  }
}
