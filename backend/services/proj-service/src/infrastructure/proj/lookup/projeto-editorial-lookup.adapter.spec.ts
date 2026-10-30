/**
 * Unit spec for ProjetoEditorialLookupAdapter (PROJ-006 / PROJ-008).
 *
 * Verified behaviours:
 *  1. exists() returns true when repository.existsByIdAndEmpresa() returns true.
 *  2. exists() returns false when repository.existsByIdAndEmpresa() returns false
 *     (projetoId inexistente — satisfies PROJ-006 missing item).
 *  3. exists() returns false for a project of another empresa (cross-tenant safety):
 *     the adapter reads empresaId from EmpresaContextStore (AsyncLocalStorage),
 *     so empresa-A's request will query empresa-A's schema and return false for a
 *     project that exists only in empresa-B.
 *  4. exists() passes the active empresaId to existsByIdAndEmpresa (not empty string).
 *  5. exists() does NOT throw — returns false as the safe default.
 *
 * The adapter is tested at unit level: ProjetoEditorialRepository is mocked
 * with jest.fn(). EmpresaContextStore is seeded via EmpresaContextStore.run()
 * so no Nest bootstrap, no DB, and no real AsyncLocalStorage infrastructure
 * is required.
 *
 * RULE-05: infrastructure/ spec, does not import from modules/.
 */

import { ProjetoEditorialLookupAdapter } from './projeto-editorial-lookup.adapter';
import { type ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import { EmpresaContextStore } from '../../context/empresa.context';

const EMPRESA_A = 'empresa-a';
const EMPRESA_B = 'empresa-b';

describe('ProjetoEditorialLookupAdapter (PROJ-006 / PROJ-008)', () => {
  let adapter: ProjetoEditorialLookupAdapter;
  let mockRepository: jest.Mocked<Pick<ProjetoEditorialRepository, 'existsByIdAndEmpresa'>>;

  beforeEach(() => {
    mockRepository = {
      existsByIdAndEmpresa: jest.fn(),
    };

    adapter = new ProjetoEditorialLookupAdapter(
      mockRepository as unknown as ProjetoEditorialRepository,
    );
  });

  // ---------------------------------------------------------------------------
  // PROJ-006 core: exists() returns false for unknown projetoId (never throws)
  // ---------------------------------------------------------------------------

  it('returns false for a projetoId that does not exist (missing item PROJ-006)', async () => {
    mockRepository.existsByIdAndEmpresa.mockResolvedValue(false);

    const result = await EmpresaContextStore.run(
      { editoraId: EMPRESA_A, slug: EMPRESA_A },
      () => adapter.exists('id-inexistente'),
    );

    expect(result).toBe(false);
  });

  it('returns true when the repository confirms project exists', async () => {
    mockRepository.existsByIdAndEmpresa.mockResolvedValue(true);

    const result = await EmpresaContextStore.run(
      { editoraId: EMPRESA_A, slug: EMPRESA_A },
      () => adapter.exists('uuid-projeto-valid'),
    );

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // PROJ-006: adapter passes real empresaId (not empty string) to repository
  // ---------------------------------------------------------------------------

  it('passes the active empresaId from EmpresaContextStore to existsByIdAndEmpresa', async () => {
    mockRepository.existsByIdAndEmpresa.mockResolvedValue(true);
    const projetoId = 'uuid-projeto-empresa-a';

    await EmpresaContextStore.run(
      { editoraId: EMPRESA_A, slug: EMPRESA_A },
      () => adapter.exists(projetoId),
    );

    expect(mockRepository.existsByIdAndEmpresa).toHaveBeenCalledWith(projetoId, EMPRESA_A);
    expect(mockRepository.existsByIdAndEmpresa).not.toHaveBeenCalledWith(projetoId, '');
  });

  // ---------------------------------------------------------------------------
  // Cross-tenant safety: project of another empresa returns false, not throws
  // ---------------------------------------------------------------------------

  it('returns false for a project of another empresa (cross-tenant safety)', async () => {
    // Simulates: empresa-B's schema does not contain empresa-A's project.
    // When the request is scoped to empresa-B (EmpresaContextStore holds empresa-B),
    // the adapter queries empresa-B's schema — empresa-A's project is absent → false.
    mockRepository.existsByIdAndEmpresa.mockResolvedValue(false);

    const result = await EmpresaContextStore.run(
      { editoraId: EMPRESA_B, slug: EMPRESA_B },
      () => adapter.exists('uuid-empresa-a-projeto'),
    );

    // Must return false (not throw) — caller treats this as "not found"
    expect(result).toBe(false);
    // The adapter must forward empresa-B's id (the active context), not empresa-A's
    expect(mockRepository.existsByIdAndEmpresa).toHaveBeenCalledWith(
      'uuid-empresa-a-projeto',
      EMPRESA_B,
    );
  });

  it('delegates to existsByIdAndEmpresa — does not throw on any repository false', async () => {
    mockRepository.existsByIdAndEmpresa.mockResolvedValue(false);

    await expect(
      EmpresaContextStore.run(
        { editoraId: EMPRESA_A, slug: EMPRESA_A },
        () => adapter.exists('any-id'),
      ),
    ).resolves.toBe(false);
    expect(mockRepository.existsByIdAndEmpresa).toHaveBeenCalledTimes(1);
  });
});
