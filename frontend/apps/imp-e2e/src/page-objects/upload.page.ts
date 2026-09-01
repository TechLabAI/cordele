/**
 * upload.page.ts — Page Object for T03 Upload (/imp/upload).
 * FE-IMP-024: 9 Playwright e2e scenarios for upload-manuscrito.feature.
 *
 * Selectors are derived from the real component templates (P4/P6):
 *   - imp-manuscript-drop-zone  → ManuscriptDropZoneComponent (selector: imp-manuscript-drop-zone)
 *   - imp-project-name-field    → ProjectNameFieldComponent (selector: imp-project-name-field)
 *   - imp-import-submit-button  → ImportSubmitButtonComponent (selector: imp-import-submit-button)
 *   - imp-upload-progress-card  → UploadProgressCardComponent (selector: imp-upload-progress-card)
 */
import { Page, Locator, expect } from '@playwright/test';

export class UploadPage {
  readonly page: Page;

  // Root component
  private readonly root: Locator;

  // Sub-component roots
  private readonly dropZone: Locator;
  private readonly projectNameField: Locator;
  private readonly submitButton: Locator;
  private readonly progressCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root            = page.locator('imp-upload');
    this.dropZone        = page.locator('imp-manuscript-drop-zone');
    this.projectNameField = page.locator('imp-project-name-field');
    this.submitButton    = page.locator('imp-import-submit-button button');
    this.progressCard    = page.locator('imp-upload-progress-card');
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Navigate to the new-project upload route (/imp/upload). */
  async goto(): Promise<void> {
    await this.page.goto('/imp/upload');
  }

  /**
   * Navigate to the existing-project import route
   * (/imp/projetos/{projetoId}/importar).
   */
  async gotoExistingProject(projetoId: string): Promise<void> {
    await this.page.goto(`/imp/projetos/${projetoId}/importar`);
  }

  // ── Form interactions ─────────────────────────────────────────────────────

  /** Fill the "Nome do projeto" input field. */
  async fillProjectName(name: string): Promise<void> {
    const input = this.projectNameField.locator('input[type="text"]');
    await input.fill(name);
  }

  /**
   * Set a file on the hidden file input of the drop zone.
   * Uses Playwright's setInputFiles — works for both click and drag-and-drop triggers.
   */
  async selectFile(
    fileName: string,
    content: Buffer | string,
    mimeType: string,
  ): Promise<void> {
    const fileInput = this.dropZone.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType,
      buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
    });
  }

  /** Click the "Importar manuscrito" submit button. */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  // ── State queries ─────────────────────────────────────────────────────────

  /** True if the submit button is disabled (aria or HTML disabled attribute). */
  async isSubmitDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled();
  }

  /**
   * Wait for navigation to the T04 review route and assert the URL matches
   * /imp/manuscritos/{manuscritoId}/revisao.
   */
  async waitForNavigationToRevisao(manuscritoId: string): Promise<void> {
    await this.page.waitForURL(`**/imp/manuscritos/${manuscritoId}/revisao`, { timeout: 10_000 });
    await expect(this.page).toHaveURL(new RegExp(`/imp/manuscritos/${manuscritoId}/revisao`));
  }

  /** Wait for URL to match /imp/manuscritos/.+/revisao (any manuscritoId). */
  async waitForAnyRevisaoNavigation(): Promise<void> {
    await this.page.waitForURL(/\/imp\/manuscritos\/.+\/revisao/, { timeout: 10_000 });
  }

  /** Assert the drop zone shows a validation error containing the given text fragment. */
  async expectDropZoneError(fragment: string): Promise<void> {
    // Use role="alert" to scope to exactly the error <p> and avoid matching the
    // informational hint <p> that also contains size/format tokens (e.g. "50 MB").
    const errorEl = this.dropZone.locator('[role="alert"]').filter({ hasText: fragment });
    await expect(errorEl).toBeVisible();
  }

  /** Assert the indeterminate "analisando estrutura" progress indicator is visible. */
  async expectIndeterminateIndicator(): Promise<void> {
    await expect(
      this.progressCard.getByText('analisando estrutura', { exact: false }),
    ).toBeVisible();
  }

  /** Assert the error card (with retry button) is visible and contains the given fragment. */
  async expectErrorCard(fragment: string): Promise<void> {
    await expect(this.progressCard).toBeVisible();
    await expect(this.progressCard.getByText(fragment, { exact: false })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  }

  /** Assert the error card shows the "Reimportar" action (parse-failed scenario). */
  async expectParseFailedErrorCard(): Promise<void> {
    await expect(this.progressCard).toBeVisible();
    await expect(this.progressCard.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  }

  /** True if the URL is still at the upload page (no navigation happened). */
  async isStillOnUploadPage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/imp/upload') || url.includes('/importar');
  }
}
