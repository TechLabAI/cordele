import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import type { ContentTreeDto, ManuscriptContentPort } from '../../../modules/comp/ports/manuscript-content.port';

/**
 * Stub adapter for ManuscriptContentPort (COMP-014 / P4).
 *
 * Reads a content tree fixture from disk and returns it for any projetoId
 * that is NOT listed in COMP_STUB_NO_MANUSCRIPT_IDS. When the projetoId is
 * in the exclusion list, returns null (simulates a project with no manuscript
 * yet — the 409 path for GetPreviewContextUseCase).
 *
 * Environment variables:
 *   COMP_STUB_MANUSCRIPT_FIXTURE_PATH  — path to a JSON file conforming to
 *                                         ContentTreeDto (defaults to
 *                                         test/fixtures/content-tree.json
 *                                         relative to cwd).
 *   COMP_STUB_NO_MANUSCRIPT_IDS        — comma-separated UUIDs that should
 *                                         resolve to null (no manuscript).
 *
 * INT-COMP-001: when IMP scaffold becomes available, swap this provider for
 * ManuscritoQueryHttpAdapter in CompModule without changing any use case.
 *
 * RULE-06: lives in infrastructure/comp/manuscript (outbound client boundary). ✓
 * RULE-01/02: no @prisma/client or domain entity imports. ✓
 */
@Injectable()
export class ManuscriptContentStubAdapter implements ManuscriptContentPort {
  private readonly logger = new Logger(ManuscriptContentStubAdapter.name);

  private readonly fixturePath: string;
  private readonly noManuscriptIds: Set<string>;

  /** Cached fixture to avoid re-reading from disk on each call. */
  private cachedFixture: ContentTreeDto | null = null;

  constructor() {
    this.fixturePath =
      process.env.COMP_STUB_MANUSCRIPT_FIXTURE_PATH ?? 'test/fixtures/content-tree.json';

    const raw = process.env.COMP_STUB_NO_MANUSCRIPT_IDS ?? '';
    this.noManuscriptIds = new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    );

    this.logger.log(
      `ManuscriptContentStubAdapter initialised. fixture=${this.fixturePath} noManuscriptIds=${this.noManuscriptIds.size}`,
    );
  }

  async getContentTree(projetoId: string): Promise<ContentTreeDto | null> {
    if (this.noManuscriptIds.has(projetoId)) {
      this.logger.debug(`getContentTree: projetoId ${projetoId} is in COMP_STUB_NO_MANUSCRIPT_IDS — returning null`);
      return null;
    }

    const fixture = await this.loadFixture();
    // Return fixture with caller's projetoId mapped to manuscritoId so the use case sees a consistent view.
    return { ...fixture, manuscritoId: projetoId };
  }

  async nodeExists(projetoId: string, referenciaNo: string): Promise<boolean> {
    const tree = await this.getContentTree(projetoId);
    if (tree === null) return false;

    const searchNodes = (nodes: ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>): boolean => {
      for (const node of nodes) {
        if ((node as { nodeId?: string }).nodeId === referenciaNo) return true;
        const children = (node as { children?: ReadonlyArray<unknown> }).children;
        if (children && searchNodes(children as ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>)) return true;
      }
      return false;
    };

    return searchNodes(tree.estrutura as ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadFixture(): Promise<ContentTreeDto> {
    if (this.cachedFixture !== null) {
      return this.cachedFixture;
    }

    let raw: string;
    try {
      raw = await readFile(this.fixturePath, 'utf-8');
    } catch (err) {
      this.logger.error(
        `Failed to read manuscript fixture from "${this.fixturePath}": ${(err as Error).message}`,
      );
      throw err;
    }

    const parsed: unknown = JSON.parse(raw);
    this.cachedFixture = parsed as ContentTreeDto;

    this.logger.debug(`Fixture loaded from "${this.fixturePath}"`);
    return this.cachedFixture;
  }
}
