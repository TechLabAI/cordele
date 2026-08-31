import {
  GetConfiguracaoLayoutExportUseCase,
  LayoutRead,
} from './get-configuracao-layout-export.use-case';
import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride } from '../../../domain/comp/layout-override.entity';
import type { ConfiguracaoLayoutRepositoryPort } from '../ports/configuracao-layout-repository.port';
import type { ManuscriptContentPort } from '../ports/manuscript-content.port';

/**
 * Unit spec for GetConfiguracaoLayoutExportUseCase (COMP-016, D-I / G2).
 *
 * Verifies the in-process export contract:
 *   - Stale override excluded: override whose nodeExists=false is NOT in result.
 *   - Non-stale override included: override whose nodeExists=true IS in result.
 *   - Absent layout → null: returns null when no row exists.
 *   - Only §7.3 parameters in the response (no extra fields, no materialized/stale).
 *
 * Ports are mocked with jest.fn() — no DB, no Nest bootstrap.
 */

const PROJETO_ID = '44444444-4444-4444-8444-444444444444';
const ATUALIZADOEM = new Date('2026-08-25T14:40:00Z');

const makeLayoutRepo = (): jest.Mocked<ConfiguracaoLayoutRepositoryPort> => ({
  findByProjetoId: jest.fn(),
  upsert: jest.fn(),
});

const makeManuscriptPort = (): jest.Mocked<ManuscriptContentPort> => ({
  getContentTree: jest.fn(),
  nodeExists: jest.fn(),
});

/** Build a ConfiguracaoLayout aggregate with a given set of overrides. */
const makeLayout = (overrides: LayoutOverride[] = []): ConfiguracaoLayout =>
  new ConfiguracaoLayout({
    id: 'layout-id-001',
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
    empresaSlug: 'aetos',
    atualizadoEm: ATUALIZADOEM,
  });

/** Build a non-stale imagem LayoutOverride. */
const makeOverride = (referenciaNo: string, ordem: number): LayoutOverride =>
  new LayoutOverride({ referenciaNo, tipo: 'imagem', alinhamento: 'centralizado', ordem });

describe('GetConfiguracaoLayoutExportUseCase', () => {
  let useCase: GetConfiguracaoLayoutExportUseCase;
  let layoutRepo: jest.Mocked<ConfiguracaoLayoutRepositoryPort>;
  let manuscript: jest.Mocked<ManuscriptContentPort>;

  beforeEach(() => {
    layoutRepo = makeLayoutRepo();
    manuscript = makeManuscriptPort();
    useCase = new GetConfiguracaoLayoutExportUseCase(
      layoutRepo as unknown as ConfiguracaoLayoutRepositoryPort,
      manuscript as unknown as ManuscriptContentPort,
    );
  });

  // ---------------------------------------------------------------------------
  // Absent layout
  // ---------------------------------------------------------------------------

  it('returns null when repository returns null (no composition exists)', async () => {
    layoutRepo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.get(PROJETO_ID);

    expect(result).toBeNull();
    expect(layoutRepo.findByProjetoId).toHaveBeenCalledWith(PROJETO_ID);
    // nodeExists must NOT be called when there is no layout.
    expect(manuscript.nodeExists).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Stale override excluded
  // ---------------------------------------------------------------------------

  it('excludes stale override: override whose nodeExists=false is absent from result', async () => {
    const staleOverride = makeOverride('img-stale', 1);
    const layout = makeLayout([staleOverride]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);
    // Simulate stale: node no longer exists in the manuscript tree.
    manuscript.nodeExists.mockResolvedValue(false);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    expect(dto.overrides).toHaveLength(0);
    expect(manuscript.nodeExists).toHaveBeenCalledWith(PROJETO_ID, 'img-stale');
  });

  // ---------------------------------------------------------------------------
  // Non-stale override included
  // ---------------------------------------------------------------------------

  it('includes non-stale override: override whose nodeExists=true is present in result', async () => {
    const activeOverride = makeOverride('img-active', 1);
    const layout = makeLayout([activeOverride]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);
    manuscript.nodeExists.mockResolvedValue(true);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    expect(dto.overrides).toHaveLength(1);
    expect(dto.overrides[0].referenciaNo).toBe('img-active');
    expect(dto.overrides[0].alinhamento).toBe('centralizado');
    expect(dto.overrides[0].ordem).toBe(1);
  });

  it('keeps only the non-stale override when mixed stale/non-stale set provided', async () => {
    const o1 = makeOverride('img-node-1', 1);
    const o2 = makeOverride('img-node-2', 2);
    const o3 = makeOverride('img-node-3', 3);
    const layout = makeLayout([o1, o2, o3]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);
    // img-node-1: stale, img-node-2: active, img-node-3: stale
    manuscript.nodeExists.mockImplementation(async (_pid, referenciaNo) => {
      return referenciaNo === 'img-node-2';
    });

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    expect(dto.overrides).toHaveLength(1);
    expect(dto.overrides[0].referenciaNo).toBe('img-node-2');
    // nodeExists called for all 3 overrides.
    expect(manuscript.nodeExists).toHaveBeenCalledTimes(3);
  });

  // ---------------------------------------------------------------------------
  // §7.3 parameter set only in the response
  // ---------------------------------------------------------------------------

  it('returns only §7.3 honoured parameters — no extra fields', async () => {
    const layout = makeLayout([]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    // Required §7.3 fields present.
    expect(dto.fonteCorpoFamilia).toBe('serif');
    expect(dto.fonteCorpoTamanho).toBe(12);
    expect(dto.espacamentoLinha).toBe(1.5);
    expect(dto.margemLateral).toBe(20);
    expect(dto.h1Tamanho).toBe(28);
    expect(dto.h2Tamanho).toBe(22);
    expect(dto.h3Tamanho).toBe(18);
    expect(dto.overrides).toHaveLength(0);
    expect(dto.atualizadoEm).toBe(ATUALIZADOEM);
    // Fields NOT in §7.3 must be absent.
    expect((dto as unknown as Record<string, unknown>)['materialized']).toBeUndefined();
    expect((dto as unknown as Record<string, unknown>)['stale']).toBeUndefined();
    expect((dto as unknown as Record<string, unknown>)['empresaSlug']).toBeUndefined();
    // Internal domain field names (snake_case) must NOT leak into the DTO.
    expect((dto as unknown as Record<string, unknown>)['fonte_corpo_familia']).toBeUndefined();
    expect((dto as unknown as Record<string, unknown>)['fonte_corpo_tamanho']).toBeUndefined();
  });

  it('maps typography fields to camelCase as per api-contract §6.2', async () => {
    const layout = makeLayout([]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    expect(dto).toHaveProperty('fonteCorpoFamilia');
    expect(dto).toHaveProperty('fonteCorpoTamanho');
    expect(dto).toHaveProperty('espacamentoLinha');
    expect(dto).toHaveProperty('margemLateral');
    expect(dto).toHaveProperty('h1Tamanho');
    expect(dto).toHaveProperty('h2Tamanho');
    expect(dto).toHaveProperty('h3Tamanho');
  });

  it('does not expose stale flag on individual override items in the response', async () => {
    const activeOverride = makeOverride('img-clean', 0);
    const layout = makeLayout([activeOverride]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);
    manuscript.nodeExists.mockResolvedValue(true);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as LayoutRead;
    expect(dto.overrides).toHaveLength(1);
    // `stale` must not be present on the exported override DTO.
    expect((dto.overrides[0] as unknown as Record<string, unknown>)['stale']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  it('propagates repository errors', async () => {
    layoutRepo.findByProjetoId.mockRejectedValue(new Error('DB failure'));

    await expect(useCase.get(PROJETO_ID)).rejects.toThrow('DB failure');
  });

  it('propagates ManuscriptContentPort errors', async () => {
    const layout = makeLayout([makeOverride('img-err', 0)]);
    layoutRepo.findByProjetoId.mockResolvedValue(layout);
    manuscript.nodeExists.mockRejectedValue(new Error('IMP unavailable'));

    await expect(useCase.get(PROJETO_ID)).rejects.toThrow('IMP unavailable');
  });
});
