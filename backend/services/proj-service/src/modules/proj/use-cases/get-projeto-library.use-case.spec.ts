/**
 * Unit tests for GetProjetoLibraryUseCase (PROJ-010).
 *
 * Critical invariants verified:
 *  1. Exactly 3 port calls per library request (batching — SPEC-10 clause 3).
 *  2. degraded=true when any port throws; own fields still returned (SPEC-07).
 *  3. Cards reflect cross-context data when all ports succeed.
 *  4. ?status filter propagated to repository (DB-level filter, not in-memory).
 *  5. Empty project list short-circuits port calls (no wasted round-trips).
 */

import { GetProjetoLibraryUseCase } from './get-projeto-library.use-case';
import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from '../../../domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from '../../../domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-25T10:00:00Z');

function makeProject(id: string, status = ProjetoStatus.rascunho) {
  return {
    id,
    nome: `Projeto ${id}`,
    descricao: null,
    editoraId: 'emp-aetos',
    status,
    criadoEm: NOW,
    atualizadoEm: NOW,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GetProjetoLibraryUseCase', () => {
  let repository: jest.Mocked<ProjetoEditorialRepository>;
  let manuscriptPort: jest.Mocked<ManuscriptSummaryPort>;
  let metadataPort: jest.Mocked<ProjectMetadataPort>;
  let publicationPort: jest.Mocked<PublicationHistoryPort>;
  let useCase: GetProjetoLibraryUseCase;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
    } as unknown as jest.Mocked<ProjetoEditorialRepository>;

    manuscriptPort = {
      summaries: jest.fn(),
    } as jest.Mocked<ManuscriptSummaryPort>;

    metadataPort = {
      metadata: jest.fn(),
    } as jest.Mocked<ProjectMetadataPort>;

    publicationPort = {
      latest: jest.fn(),
      history: jest.fn(),
      signedDownloadUrl: jest.fn(),
    } as jest.Mocked<PublicationHistoryPort>;

    // Create use case directly (no Nest DI needed for unit tests)
    useCase = new GetProjetoLibraryUseCase(
      repository,
      manuscriptPort,
      metadataPort,
      publicationPort,
    );
  });

  describe('batching invariant', () => {
    it('calls each port exactly once per request regardless of project count', async () => {
      const projects = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5'].map((id) =>
        makeProject(id, ProjetoStatus.publicado),
      );
      repository.findAll.mockResolvedValue(projects);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos' });

      // SPEC-10 clause 3: exactly 1 call per port regardless of project count
      expect(manuscriptPort.summaries).toHaveBeenCalledTimes(1);
      expect(metadataPort.metadata).toHaveBeenCalledTimes(1);
      expect(publicationPort.latest).toHaveBeenCalledTimes(1);

      // All 5 project IDs passed in one call (no N+1)
      const ids = projects.map((p) => p.id);
      expect(manuscriptPort.summaries).toHaveBeenCalledWith(ids, 'emp-aetos');
      expect(metadataPort.metadata).toHaveBeenCalledWith(ids, 'emp-aetos');
      expect(publicationPort.latest).toHaveBeenCalledWith(ids, 'emp-aetos');
    });

    it('makes zero port calls when repository returns empty list', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.cards).toHaveLength(0);
      expect(result.degraded).toBe(false);
      expect(manuscriptPort.summaries).not.toHaveBeenCalled();
      expect(metadataPort.metadata).not.toHaveBeenCalled();
      expect(publicationPort.latest).not.toHaveBeenCalled();
    });
  });

  describe('degraded fallback', () => {
    it('returns degraded=true and zero manuscript counts when ManuscriptSummaryPort throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockRejectedValue(new Error('IMP unavailable'));
      metadataPort.metadata.mockResolvedValue(new Map([['id-1', { autor: 'Ana Lima' }]]));
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
      expect(result.cards).toHaveLength(1);
      // Own fields (id, nome, status) are always present
      expect(result.cards[0].id).toBe('id-1');
      expect(result.cards[0].status).toBe(ProjetoStatus.publicado);
      // Cross-context fields from failed port fall back to defaults
      expect(result.cards[0].totalCapitulos).toBe(0);
      expect(result.cards[0].totalImagens).toBe(0);
      // Other ports still contribute their data
      expect(result.cards[0].autor).toBe('Ana Lima');
    });

    it('returns degraded=true when ProjectMetadataPort throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(
        new Map([['id-1', { totalCapitulos: 5, totalImagens: 2 }]]),
      );
      metadataPort.metadata.mockRejectedValue(new Error('COMP unavailable'));
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
      expect(result.cards[0].autor).toBeNull();
      // Manuscript port data still present
      expect(result.cards[0].totalCapitulos).toBe(5);
    });

    it('returns degraded=true when PublicationHistoryPort throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockRejectedValue(new Error('PUB unavailable'));

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
      expect(result.cards[0].ultimoEpubcheckStatus).toBeNull();
    });
  });

  describe('happy path', () => {
    it('assembles card with all cross-context fields when all ports succeed', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(
        new Map([['id-1', { totalCapitulos: 18, totalImagens: 3 }]]),
      );
      metadataPort.metadata.mockResolvedValue(
        new Map([['id-1', { autor: 'Eliana Moraes' }]]),
      );
      publicationPort.latest.mockResolvedValue(
        new Map([['id-1', { publicacaoId: 'pub-1', epubcheckStatus: 'avisos' }]]),
      );

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(false);
      expect(result.cards).toHaveLength(1);
      const card = result.cards[0];
      expect(card.totalCapitulos).toBe(18);
      expect(card.totalImagens).toBe(3);
      expect(card.autor).toBe('Eliana Moraes');
      expect(card.ultimoEpubcheckStatus).toBe('avisos');
    });

    it('shows totalCapitulos=0 and totalImagens=0 for a project with no manuscript', async () => {
      const project = makeProject('id-2', ProjetoStatus.rascunho);
      repository.findAll.mockResolvedValue([project]);
      // Port returns empty Map (no entry for id-2)
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(false);
      expect(result.cards[0].totalCapitulos).toBe(0);
      expect(result.cards[0].totalImagens).toBe(0);
      expect(result.cards[0].status).toBe(ProjetoStatus.rascunho);
    });

    it('propagates status filter to repository', async () => {
      repository.findAll.mockResolvedValue([]);

      await useCase.execute({ empresaId: 'emp-aetos', status: ProjetoStatus.rascunho });

      expect(repository.findAll).toHaveBeenCalledWith(
        'emp-aetos',
        expect.objectContaining({ status: ProjetoStatus.rascunho }),
      );
    });
  });
});
