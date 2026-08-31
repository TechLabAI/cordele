import { GetLayoutPreviewUseCase } from './get-layout-preview.use-case';
import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride } from '../../../domain/comp/layout-override.entity';
import { DomainException } from '../../../domain/shared/domain-exception';
import type { ConfiguracaoLayoutRepositoryPort } from '../ports/configuracao-layout-repository.port';
import type { ManuscriptContentPort, ContentTreeDto } from '../ports/manuscript-content.port';

/**
 * Unit spec for GetLayoutPreviewUseCase (COMP-008).
 *
 * Verifies:
 *  - No manuscript → 409 DomainException (manuscript-missing).
 *  - Stale override excluded from honoured set; stale=true on returned override.
 *  - ManuscriptContentPort throws → explicit error propagated.
 *  - Valid path → all data assembled (tree + layout + stale list).
 *  - Lazy default (D-M) for missing layout row.
 * All ports are mocked — no DB, no Nest.
 */

const PROJETO_ID = '33333333-3333-4333-8333-333333333333';

const makeLayoutRepo = (): jest.Mocked<ConfiguracaoLayoutRepositoryPort> => ({
  findByProjetoId: jest.fn(),
  upsert: jest.fn(),
});

const makeManuscriptPort = (): jest.Mocked<ManuscriptContentPort> => ({
  getContentTree: jest.fn(),
  nodeExists: jest.fn(),
});

const makeTree = (nodeIds: string[]): ContentTreeDto => ({
  manuscritoId: 'msc-fixture-001',
  estrutura: nodeIds.map((nodeId) => ({ nodeId, tipo: 'imagem' })),
});

const makeLayoutWithOverrides = (overrides: LayoutOverride[]): ConfiguracaoLayout =>
  new ConfiguracaoLayout({
    projetoId: PROJETO_ID,
    fonte_corpo_familia: 'serif',
    fonte_corpo_tamanho: 12,
    espacamento_linha: 1.5,
    margem_lateral: 20,
    h1_tamanho: 28,
    h2_tamanho: 22,
    h3_tamanho: 18,
    overrides,
    materialized: true,
  });

describe('GetLayoutPreviewUseCase', () => {
  let useCase: GetLayoutPreviewUseCase;
  let layoutRepo: jest.Mocked<ConfiguracaoLayoutRepositoryPort>;
  let manuscript: jest.Mocked<ManuscriptContentPort>;

  beforeEach(() => {
    layoutRepo = makeLayoutRepo();
    manuscript = makeManuscriptPort();
    useCase = new GetLayoutPreviewUseCase(
      layoutRepo as unknown as ConfiguracaoLayoutRepositoryPort,
      manuscript as unknown as ManuscriptContentPort,
    );
  });

  // ---------------------------------------------------------------------------
  // no manuscript → 409 (COMP-008)
  // ---------------------------------------------------------------------------

  it('throws 409 DomainException when no manuscript exists', async () => {
    manuscript.getContentTree.mockResolvedValue(null);
    layoutRepo.findByProjetoId.mockResolvedValue(null);

    await expect(useCase.execute({ projetoId: PROJETO_ID })).rejects.toThrow(DomainException);

    const err = await useCase.execute({ projetoId: PROJETO_ID }).catch((e: DomainException) => e);
    expect((err as DomainException).code).toBe('MANUSCRIPT_MISSING');
    expect((err as DomainException).status).toBe(409);
  });

  // ---------------------------------------------------------------------------
  // ManuscriptContentPort throws → explicit error propagated
  // ---------------------------------------------------------------------------

  it('propagates error when ManuscriptContentPort throws', async () => {
    const serviceError = new Error('IMP service unavailable');
    manuscript.getContentTree.mockRejectedValue(serviceError);
    layoutRepo.findByProjetoId.mockResolvedValue(null);

    await expect(useCase.execute({ projetoId: PROJETO_ID })).rejects.toThrow('IMP service unavailable');
  });

  // ---------------------------------------------------------------------------
  // Lazy defaults (D-M)
  // ---------------------------------------------------------------------------

  it('returns lazy default layout when no layout row exists', async () => {
    manuscript.getContentTree.mockResolvedValue(makeTree([]));
    layoutRepo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    expect(result.layout.materialized).toBe(false);
    expect(result.layout.projetoId).toBe(PROJETO_ID);
  });

  // ---------------------------------------------------------------------------
  // Stale override excluded from honoured set; stale=true on response object
  // ---------------------------------------------------------------------------

  it('marks override stale when referenciaNo is absent from content tree', async () => {
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 });
    const layout = makeLayoutWithOverrides([override]);

    manuscript.getContentTree.mockResolvedValue(makeTree(['img-002'])); // img-001 absent
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    expect(result.staleOverrides).toHaveLength(1);
    expect(result.layout.activeOverrides()).toHaveLength(0);
    expect(result.layout.staleOverrides()[0].referenciaNo).toBe('img-001');
  });

  it('stale override appears with stale=true in the response layout', async () => {
    const override = new LayoutOverride({ referenciaNo: 'img-absent', tipo: 'imagem', alinhamento: 'centralizado', ordem: 0 });
    const layout = makeLayoutWithOverrides([override]);

    manuscript.getContentTree.mockResolvedValue(makeTree(['img-present']));
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    const stale = result.staleOverrides[0];
    expect(stale.stale).toBe(true);
    expect(stale.referenciaNo).toBe('img-absent');
  });

  it('keeps override active when referenciaNo resolves in content tree', async () => {
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'centralizado', ordem: 0 });
    const layout = makeLayoutWithOverrides([override]);

    manuscript.getContentTree.mockResolvedValue(makeTree(['img-001']));
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    expect(result.staleOverrides).toHaveLength(0);
    expect(result.layout.activeOverrides()).toHaveLength(1);
    expect(result.layout.activeOverrides()[0].referenciaNo).toBe('img-001');
  });

  it('marks all overrides stale when all referenciaNo are absent (D-K)', async () => {
    const overrides = [
      new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 }),
      new LayoutOverride({ referenciaNo: 'img-002', tipo: 'imagem', alinhamento: 'centralizado', ordem: 1 }),
    ];
    const layout = makeLayoutWithOverrides(overrides);

    manuscript.getContentTree.mockResolvedValue(makeTree([])); // empty tree — all absent
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    expect(result.staleOverrides).toHaveLength(2);
    expect(result.layout.activeOverrides()).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Valid path → all data assembled
  // ---------------------------------------------------------------------------

  it('assembles all data: manuscrito, layout, and empty stale list for valid path', async () => {
    const tree = makeTree(['img-001', 'img-002']);
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 });
    const layout = makeLayoutWithOverrides([override]);

    manuscript.getContentTree.mockResolvedValue(tree);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.execute({ projetoId: PROJETO_ID });

    expect(result.projetoId).toBe(PROJETO_ID);
    expect(result.manuscrito).toBe(tree);
    expect(result.layout.materialized).toBe(true);
    expect(result.staleOverrides).toHaveLength(0);
    expect(result.layout.activeOverrides()).toHaveLength(1);
  });
});
