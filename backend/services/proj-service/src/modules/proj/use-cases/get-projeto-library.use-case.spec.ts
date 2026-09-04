/**
 * Unit tests for GetProjetoLibraryUseCase (PROJ-010).
 *
 * Critical invariants verified:
 *  1. Exactly 3 port calls per library request (batching — SPEC-10 clause 3).
 *  2. degraded=true when any port throws; own fields still returned (SPEC-07).
 *  3. Cards reflect cross-context data when all ports succeed.
 *  4. ?status filter propagated to repository (DB-level filter, not in-memory).
 *  5. Empty project list short-circuits port calls (no wasted round-trips).
 *  6. WARN emitted with degraded:true port=<PortName> when any port degrades (PROJ-017).
 */

import { Logger } from '@nestjs/common';
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
      delete: jest.fn(),
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

    // Create use case directly (no Nest DI needed for unit tests).
    // All three stub-mode flags are false — all ports resolve to the mocked
    // real adapters, so degraded starts at false (SPEC-07 stub-mode fix).
    useCase = new GetProjetoLibraryUseCase(
      repository,
      manuscriptPort,
      metadataPort,
      publicationPort,
      false, // manuscriptIsStub
      false, // metadataIsStub
      false, // historyIsStub
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

      // All 5 project IDs passed in one call (no N+1); bearerToken=undefined (no token in test input)
      const ids = projects.map((p) => p.id);
      expect(manuscriptPort.summaries).toHaveBeenCalledWith(ids, 'emp-aetos', undefined);
      expect(metadataPort.metadata).toHaveBeenCalledWith(ids, 'emp-aetos', undefined);
      expect(publicationPort.latest).toHaveBeenCalledWith(ids, 'emp-aetos', undefined);
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

    it('accepts limit and cursor without throwing (reserved pagination params)', async () => {
      repository.findAll.mockResolvedValue([]);

      // ?limit and ?cursor are reserved for future pagination (G5); must not cause errors.
      await expect(
        useCase.execute({ empresaId: 'emp-aetos', limit: 25, cursor: 'cursor-abc' }),
      ).resolves.toEqual({ cards: [], degraded: false });
    });
  });

  // ---------------------------------------------------------------------------
  // PROJ-017: structured WARN log on degraded port (observability)
  // ---------------------------------------------------------------------------

  describe('degraded WARN logging (PROJ-017)', () => {
    let loggerWarnSpy: jest.SpiedFunction<typeof Logger.prototype.warn>;

    beforeEach(() => {
      loggerWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerWarnSpy.mockRestore();
    });

    it('emits WARN with degraded:true port=ManuscriptSummaryPort when that port throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockRejectedValue(new Error('IMP unavailable'));
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos' });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('degraded:true port=ManuscriptSummaryPort'),
      );
    });

    it('emits WARN with degraded:true port=ProjectMetadataPort when that port throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockRejectedValue(new Error('COMP unavailable'));
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos' });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('degraded:true port=ProjectMetadataPort'),
      );
    });

    it('emits WARN with degraded:true port=PublicationHistoryPort when that port throws', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockRejectedValue(new Error('PUB unavailable'));

      await useCase.execute({ empresaId: 'emp-aetos' });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('degraded:true port=PublicationHistoryPort'),
      );
    });

    it('does NOT emit WARN when all ports succeed', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos' });

      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // SPEC-07 stub-mode degraded pre-set (Problem 3a fix)
  // ---------------------------------------------------------------------------

  describe('stub-mode flag pre-sets degraded (SPEC-07 fix)', () => {
    it('returns degraded=true when manuscriptIsStub=true even though port does not throw', async () => {
      // Instantiate with stub flag set — simulates missing IMP_SERVICE_URL.
      const useCaseWithStub = new GetProjetoLibraryUseCase(
        repository,
        manuscriptPort,
        metadataPort,
        publicationPort,
        true,  // manuscriptIsStub
        false, // metadataIsStub
        false, // historyIsStub
      );
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCaseWithStub.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
    });

    it('returns degraded=false when all stub flags are false and all ports succeed', async () => {
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Bearer token forwarding (Problem 2 fix)
  // ---------------------------------------------------------------------------

  describe('bearer token forwarding', () => {
    it('forwards bearerToken from input to all three ports', async () => {
      const project = makeProject('id-1', ProjetoStatus.publicado);
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos', bearerToken: 'test-jwt' });

      expect(manuscriptPort.summaries).toHaveBeenCalledWith(
        [project.id], 'emp-aetos', 'test-jwt',
      );
      expect(metadataPort.metadata).toHaveBeenCalledWith(
        [project.id], 'emp-aetos', 'test-jwt',
      );
      expect(publicationPort.latest).toHaveBeenCalledWith(
        [project.id], 'emp-aetos', 'test-jwt',
      );
    });

    it('passes undefined bearerToken when not provided in input', async () => {
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      await useCase.execute({ empresaId: 'emp-aetos' });

      expect(manuscriptPort.summaries).toHaveBeenCalledWith(
        [project.id], 'emp-aetos', undefined,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Real-adapter degradation path (Problem 1 fix)
  // The callPort wrapper catches exceptions thrown by the real adapter and
  // marks degraded=true. With stub flags all false, the only way degraded fires
  // is an exception from the port — previously the real adapter returned empty
  // instead of throwing, so callPort never fired and degraded stayed false.
  // ---------------------------------------------------------------------------

  describe('real-adapter degradation (Problem 1 fix)', () => {
    it('returns degraded=true when ManuscriptSummaryPort throws (real adapter path)', async () => {
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      // Simulate the real adapter throwing because IMP returned 404
      manuscriptPort.summaries.mockRejectedValue(
        new Error('IMP manuscripts/summaries returned 404 for empresaId=emp-aetos'),
      );
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      // degraded must be true — callPort caught the exception from the real adapter
      expect(result.degraded).toBe(true);
      // Other ports still contribute their data
      expect(result.cards).toHaveLength(1);
    });

    it('returns degraded=true when CompProjectMetadataPort throws (real adapter path)', async () => {
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockRejectedValue(
        new Error('COMP metadata/batch returned 404 for empresaId=emp-aetos'),
      );
      publicationPort.latest.mockResolvedValue(new Map());

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
    });

    it('returns degraded=true when PublicationHistoryPort throws (real adapter path)', async () => {
      const project = makeProject('id-1');
      repository.findAll.mockResolvedValue([project]);
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.latest.mockRejectedValue(
        new Error('PUB publications/latest-batch returned 404 for empresaId=emp-aetos'),
      );

      const result = await useCase.execute({ empresaId: 'emp-aetos' });

      expect(result.degraded).toBe(true);
    });
  });
});
