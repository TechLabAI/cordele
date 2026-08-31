import { GetMetadadosViewUseCase } from './get-metadados-view.use-case';
import { Metadados } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';

/**
 * Unit spec for GetMetadadosViewUseCase (COMP-004).
 *
 * Verifies the lazy-default contract (D-M) and normal retrieval.
 * Repository is mocked with jest.fn() — no DB, no Nest bootstrap.
 */

const PROJETO_ID = '11111111-1111-4111-8111-111111111111';
const EMPRESA_SLUG = 'aetos';

const makeRepo = (): jest.Mocked<MetadadosRepository> => ({
  findByProjetoId: jest.fn(),
  findManyByProjetoIds: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
});

describe('GetMetadadosViewUseCase', () => {
  let useCase: GetMetadadosViewUseCase;
  let repo: jest.Mocked<MetadadosRepository>;

  beforeEach(() => {
    repo = makeRepo();
    // Bypass Nest DI — inject mock directly.
    useCase = new GetMetadadosViewUseCase(repo as unknown as MetadadosRepository);
  });

  // ---------------------------------------------------------------------------
  // Happy path — row found
  // ---------------------------------------------------------------------------

  it('returns persisted aggregate when found', async () => {
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Romance das Cidades',
      autor: 'Eliana Moraes',
      idioma: 'pt',
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(result).toBe(aggregate);
    expect(result.materialized).toBe(true);
    expect(repo.findByProjetoId).toHaveBeenCalledWith(PROJETO_ID);
  });

  // ---------------------------------------------------------------------------
  // Lazy default (D-M) — no row found
  // ---------------------------------------------------------------------------

  it('should return default with materialized=false when repo returns null', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(result.materialized).toBe(false);
    expect(result.projetoId).toBe(PROJETO_ID);
    expect(result.empresaSlug).toBe(EMPRESA_SLUG);
  });

  it('returns materialized=false default when no row exists', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(result.materialized).toBe(false);
    expect(result.projetoId).toBe(PROJETO_ID);
    expect(result.empresaSlug).toBe(EMPRESA_SLUG);
    expect(result.idioma).toBe('pt');
  });

  it('never throws when repository returns null (D-M)', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG }),
    ).resolves.toBeDefined();
  });

  it('does not call upsert when repo returns null — default is not persisted', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should return existing entity without creating new row when GET called twice', async () => {
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Livro Existente',
      autor: 'Autor Real',
      idioma: 'pt',
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const first = await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });
    const second = await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    // Both calls return the existing aggregate; upsert is never called (lazy-default
    // only persists when the row is missing — which it isn't in this scenario).
    expect(first.materialized).toBe(true);
    expect(second.materialized).toBe(true);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  it('propagates repository errors', async () => {
    repo.findByProjetoId.mockRejectedValue(new Error('DB error'));

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG }),
    ).rejects.toThrow('DB error');
  });
});
