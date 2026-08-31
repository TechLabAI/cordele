import { GetMetadadosExportUseCase, MetadadosRead } from './get-metadados-export.use-case';
import { Metadados } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';

/**
 * Unit spec for GetMetadadosExportUseCase (COMP-016, D-I / G2).
 *
 * Verifies the in-process export contract:
 *   - Returns null when no row has been materialized (PUB receives null — not a lazy default).
 *   - Returns MetadadosRead DTO with §6.1 field set when the row exists.
 *   - Never exposes the Metadados aggregate / domain entity directly.
 *   - Maps all fields correctly (titulo, autor, isbn, idioma, categoria, capaUrl,
 *     editoraNome, atualizadoEm) — no extra fields, no `materialized`.
 *
 * Repository is mocked with jest.fn() — no DB, no Nest bootstrap.
 */

const PROJETO_ID = '33333333-3333-4333-8333-333333333333';
const EMPRESA_SLUG = 'aetos';

const makeRepo = (): jest.Mocked<MetadadosRepository> => ({
  findByProjetoId: jest.fn(),
  findManyByProjetoIds: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
});

describe('GetMetadadosExportUseCase', () => {
  let useCase: GetMetadadosExportUseCase;
  let repo: jest.Mocked<MetadadosRepository>;

  beforeEach(() => {
    repo = makeRepo();
    // Bypass Nest DI — inject mock directly.
    useCase = new GetMetadadosExportUseCase(repo as unknown as MetadadosRepository);
  });

  // ---------------------------------------------------------------------------
  // Absent aggregate (no row materialized yet)
  // ---------------------------------------------------------------------------

  it('returns null when repository returns null (no composition exists)', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.get(PROJETO_ID);

    expect(result).toBeNull();
    expect(repo.findByProjetoId).toHaveBeenCalledWith(PROJETO_ID);
  });

  it('does NOT return a lazy default when aggregate is absent — returns null for PUB', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    const result = await useCase.get(PROJETO_ID);

    // Unlike GetMetadadosViewUseCase, the export use case never synthesizes a default.
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Happy path — row found
  // ---------------------------------------------------------------------------

  it('returns MetadadosRead DTO when aggregate is persisted', async () => {
    const atualizadoEm = new Date('2026-08-25T14:31:46Z');
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Romance das Cidades',
      autor: 'Eliana Moraes',
      idioma: 'pt',
      isbn: '978-3-16-148410-0',
      categoria: 'romance',
      capaUrl: 'https://storage.example.com/capa-romance.jpg',
      editoraNome: 'Editora Aetós',
      atualizadoEm,
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as MetadadosRead;
    expect(dto.projetoId).toBe(PROJETO_ID);
    expect(dto.titulo).toBe('Romance das Cidades');
    expect(dto.autor).toBe('Eliana Moraes');
    expect(dto.isbn).toBe('978-3-16-148410-0');
    expect(dto.idioma).toBe('pt');
    expect(dto.categoria).toBe('romance');
    expect(dto.capaUrl).toBe('https://storage.example.com/capa-romance.jpg');
    expect(dto.editoraNome).toBe('Editora Aetós');
    expect(dto.atualizadoEm).toBe(atualizadoEm);
  });

  it('maps null optional fields correctly (isbn, categoria, capaUrl, editoraNome)', async () => {
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Poemas do Norte',
      autor: 'Maria Lins',
      idioma: 'pt',
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    const dto = result as MetadadosRead;
    expect(dto.isbn).toBeNull();
    expect(dto.categoria).toBeNull();
    expect(dto.capaUrl).toBeNull();
    expect(dto.editoraNome).toBeNull();
  });

  it('does not expose the materialized flag in the DTO (§6.5 minus materialized)', async () => {
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Livro',
      autor: 'Autor',
      idioma: 'en',
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const result = await useCase.get(PROJETO_ID);

    // `materialized` must NOT be present on MetadadosRead (§6.5).
    expect(result).not.toBeNull();
    expect((result as unknown as Record<string, unknown>)['materialized']).toBeUndefined();
  });

  it('does not expose the empresaSlug in the DTO (internal tenant detail)', async () => {
    const aggregate = new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'Livro',
      autor: 'Autor',
      idioma: 'en',
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });
    repo.findByProjetoId.mockResolvedValue(aggregate);

    const result = await useCase.get(PROJETO_ID);

    expect(result).not.toBeNull();
    expect((result as unknown as Record<string, unknown>)['empresaSlug']).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  it('propagates repository errors', async () => {
    repo.findByProjetoId.mockRejectedValue(new Error('DB error'));

    await expect(useCase.get(PROJETO_ID)).rejects.toThrow('DB error');
  });
});
