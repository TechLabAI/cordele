/**
 * review.page.ts — Page Object for T04 Revisão de Estrutura
 * (/imp/manuscritos/:manuscritoId/revisao).
 * FE-IMP-025: 9 Playwright e2e scenarios for revisao-de-estrutura.feature.
 *
 * Selectors are derived from the real component templates (P4/P5/P6):
 *   - imp-revisao-de-estrutura      → RevisaoDeEstruturaComponent (root)
 *   - imp-content-tree-skeleton     → ContentTreeSkeletonComponent (loading state)
 *   - imp-content-tree              → ContentTreeComponent (pendências list)
 *   - imp-content-block             → ContentBlockComponent (each unparsed block row)
 *   - imp-action-bar                → ActionBarComponent (confirm/reimportar)
 */
import { Page, Locator, expect } from '@playwright/test';

/** Shape returned by getCounters(). */
export interface ReviewCounters {
  capitulos: number;
  imagens: number;
  pendencias: number;
}

export class ReviewPage {
  readonly page: Page;

  private readonly root: Locator;
  private readonly skeleton: Locator;
  private readonly contentTree: Locator;
  private readonly actionBar: Locator;

  constructor(page: Page) {
    this.page        = page;
    this.root        = page.locator('imp-revisao-de-estrutura');
    this.skeleton    = page.locator('imp-content-tree-skeleton');
    this.contentTree = page.locator('imp-content-tree');
    this.actionBar   = page.locator('imp-action-bar');
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /**
   * Navigate directly to the T04 deep-link URL (no router state —
   * the component falls back to loadStructure(manuscritoId)).
   *
   * Waits for the root component to be visible to ensure Angular has rendered
   * before the caller checks for skeleton or other child elements.
   */
  async gotoDeepLink(manuscritoId: string): Promise<void> {
    await this.page.goto(`/imp/manuscritos/${manuscritoId}/revisao`);
    // Ensure the root component is rendered before returning
    // This eliminates race conditions where the skeleton might be checked
    // before Angular has finished initial rendering
    await expect(this.root).toBeVisible({ timeout: 10_000 });
  }

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * Wait until the review page is in "ready" state:
   * manuscript loaded, counters visible, action bar rendered.
   */
  async waitForReady(): Promise<void> {
    // The action bar is rendered when `facade.manuscrito()` is truthy
    await expect(this.actionBar).toBeVisible({ timeout: 10_000 });
    // Confirm button text is "Confirmar estrutura" when canConfirm=true
    await expect(
      this.actionBar.getByRole('button', { name: 'Confirmar estrutura' }),
    ).toBeVisible({ timeout: 5_000 });
  }

  /** Assert the skeleton loading state is visible (deep-link path while fetching). */
  async expectSkeletonVisible(): Promise<void> {
    await expect(this.skeleton).toBeVisible();
  }

  /** Assert the skeleton loading state is NOT visible (data is loaded). */
  async expectSkeletonHidden(): Promise<void> {
    await expect(this.skeleton).not.toBeVisible();
  }

  // ── Counters ──────────────────────────────────────────────────────────────

  /**
   * Read the three summary counters from the counter cards:
   * totalCapitulos (capítulos), totalImagens (imagens), trechosNaoParseados (pendências).
   *
   * The component renders them as bold text followed by a label — we extract by label.
   */
  async getCounters(): Promise<ReviewCounters> {
    const counterCards = this.root.locator('.grid.grid-cols-3 > div');

    const capText = await counterCards.nth(0).locator('p.text-2xl').textContent();
    const imgText = await counterCards.nth(1).locator('p.text-2xl').textContent();
    const penText = await counterCards.nth(2).locator('p.text-2xl').textContent();

    return {
      capitulos:  parseInt(capText?.trim() ?? '0', 10),
      imagens:    parseInt(imgText?.trim() ?? '0', 10),
      pendencias: parseInt(penText?.trim() ?? '0', 10),
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Click "Ignorar" on the Nth unparsed block (0-indexed).
   * The button is inside imp-content-block elements.
   */
  async ignoreFragment(index: number): Promise<void> {
    const ignoreButtons = this.contentTree.getByRole('button', { name: 'Ignorar' });
    await ignoreButtons.nth(index).click();
  }

  /**
   * Click "Restaurar" on the Nth unparsed block (0-indexed).
   * Visible after the block was ignored.
   */
  async restoreFragment(index: number): Promise<void> {
    const restoreButtons = this.contentTree.getByRole('button', { name: 'Restaurar' });
    await restoreButtons.nth(index).click();
  }

  /** Click the "Confirmar estrutura" CTA in the action bar. */
  async confirm(): Promise<void> {
    await this.actionBar
      .getByRole('button', { name: 'Confirmar estrutura' })
      .click();
  }

  /**
   * Accept the "zero capítulos" warning modal.
   * The modal button text is "Confirmar mesmo assim".
   */
  async acceptZeroChaptersModal(): Promise<void> {
    await this.page
      .getByRole('button', { name: /confirmar mesmo assim/i })
      .click();
  }

  /** Click "Reimportar outro arquivo" link in the action bar. */
  async clickReimortar(): Promise<void> {
    await this.actionBar
      .getByRole('link', { name: /reimportar outro arquivo/i })
      .click();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  /**
   * Assert that the Nth block has its "Ignorar" button replaced by "Restaurar"
   * (meaning it was ignored — optimistic update applied).
   */
  async expectFragmentIgnored(index: number): Promise<void> {
    // After ignoring, the block shows "Restaurar" (not "Ignorar")
    const blocks = this.contentTree.locator('imp-content-block');
    const block = blocks.nth(index);
    await expect(block.getByRole('button', { name: 'Restaurar' })).toBeVisible({ timeout: 3_000 });
  }

  /**
   * Assert that the Nth block is NOT ignored — shows "Ignorar" button.
   * Used to verify rollback after server rejection.
   */
  async expectFragmentNotIgnored(index: number): Promise<void> {
    const blocks = this.contentTree.locator('imp-content-block');
    const block = blocks.nth(index);
    await expect(block.getByRole('button', { name: 'Ignorar' })).toBeVisible({ timeout: 3_000 });
  }

  /**
   * Assert an error/toast message is visible (from ReviewFacade.errorMessage signal).
   * The component renders it in a div with color:var(--color-error).
   */
  async expectErrorVisible(fragment: string): Promise<void> {
    await expect(
      this.root.getByText(fragment, { exact: false }),
    ).toBeVisible({ timeout: 3_000 });
  }
}
