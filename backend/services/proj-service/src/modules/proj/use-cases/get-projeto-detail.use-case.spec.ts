/**
 * Unit tests for GetProjetoDetailUseCase (PROJ-011).
 *
 * Verified behaviours:
 *  1. Happy path: all cross-context fields composed correctly.
 *  2. Returns null for unknown/cross-tenant project → controller maps to 404.
 *  3. degraded=true and publicationHistory=[] when PUB port throws.
 *  4. status always from PROJ own row, regardless of cross-context data.
 *  5. WARN emitted with degraded:true port=<PortName> when any port degrades (PROJ-017).
 */

import { Logger } from '@nestjs/common';
import { GetProjetoDetailUseCase } from './get-projeto-detail.use-case';
import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from '../../../domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from '../../../domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

const NOW = new Date('2026-08-25T10:00:00Z');
const PROJETO_ID = 'proj-uuid-1';
const EMPRESA_ID = 'emp-aetos';

function makeProject(status = ProjetoStatus.publicado) {
  return {
    id: PROJETO_ID,
    nome: 'Meu Projeto',
    descricao: null,
    editoraId: EMPRESA_ID,
    status,
    criadoEm: NOW,
    atualizadoEm: NOW,
  };
}

describe('GetProjetoDetailUseCase', () => {
  let repository: jest.Mocked<ProjetoEditorialRepository>;
  let manuscriptPort: jest.Mocked<ManuscriptSummaryPort>;
  let metadataPort: jest.Mocked<ProjectMetadataPort>;
  let publicationPort: jest.Mocked<PublicationHistoryPort>;
  let useCase: GetProjetoDetailUseCase;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ProjetoEditorialRepository>;

    manuscriptPort = { summaries: jest.fn() } as jest.Mocked<ManuscriptSummaryPort>;
    metadataPort = { metadata: jest.fn() } as jest.Mocked<ProjectMetadataPort>;
    publicationPort = {
      latest: jest.fn(),
      history: jest.fn(),
      signedDownloadUrl: jest.fn(),
    } as jest.Mocked<PublicationHistoryPort>;

    useCase = new GetProjetoDetailUseCase(
      repository,
      manuscriptPort,
      metadataPort,
      publicationPort,
    );
  });

  it('returns null when project does not exist (cross-tenant safety)', async () => {
    repository.findById.mockResolvedValue(null);

    const result = await useCase.execute({ projetoId: 'unknown', empresaId: EMPRESA_ID });

    expect(result).toBeNull();
    expect(manuscriptPort.summaries).not.toHaveBeenCalled();
  });

  it('composes all cross-context fields in the happy path', async () => {
    repository.findById.mockResolvedValue(makeProject());
    manuscriptPort.summaries.mockResolvedValue(
      new Map([[PROJETO_ID, { totalCapitulos: 12, totalImagens: 4 }]]),
    );
    metadataPort.metadata.mockResolvedValue(
      new Map([[PROJETO_ID, { autor: 'Ana Lima' }]]),
    );
    publicationPort.history.mockResolvedValue([
      {
        publicacaoId: 'pub-1',
        projetoId: PROJETO_ID,
        epubcheckStatus: 'valido',
        totalErros: 0,
        totalAvisos: 0,
        criadoEm: NOW.toISOString(),
      },
    ]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result).not.toBeNull();
    expect(result!.status).toBe(ProjetoStatus.publicado);
    expect(result!.degraded).toBe(false);
    expect((result!.manuscriptSummary as any)?.totalCapitulos).toBe(12);
    expect((result!.metadata as any)?.autor).toBe('Ana Lima');
    expect((result!.publicationHistory as any[])?.length).toBe(1);
  });

  it('returns degraded=true and publicationHistory=[] when PUB port throws', async () => {
    repository.findById.mockResolvedValue(makeProject());
    manuscriptPort.summaries.mockResolvedValue(new Map());
    metadataPort.metadata.mockResolvedValue(new Map());
    publicationPort.history.mockRejectedValue(new Error('PUB unavailable'));

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result).not.toBeNull();
    expect(result!.degraded).toBe(true);
    expect(result!.publicationHistory).toEqual([]);
    // status from own row always present
    expect(result!.status).toBe(ProjetoStatus.publicado);
  });

  it('status is always sourced from PROJ repository, never from cross-context ports', async () => {
    repository.findById.mockResolvedValue(makeProject(ProjetoStatus.em_composicao));
    manuscriptPort.summaries.mockResolvedValue(new Map());
    metadataPort.metadata.mockResolvedValue(new Map());
    publicationPort.history.mockResolvedValue([]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result!.status).toBe(ProjetoStatus.em_composicao);
  });

  it('status always present in response even when ManuscriptSummaryPort degrades', async () => {
    // SPEC-10 invariant: own PROJ fields (id, status, nome) are always returned
    // regardless of cross-context port availability.
    repository.findById.mockResolvedValue(makeProject(ProjetoStatus.publicado));
    manuscriptPort.summaries.mockRejectedValue(new Error('IMP unavailable'));
    metadataPort.metadata.mockResolvedValue(new Map());
    publicationPort.history.mockResolvedValue([]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result).not.toBeNull();
    expect(result!.degraded).toBe(true);
    // Own fields — always present regardless of port state
    expect(result!.id).toBe(PROJETO_ID);
    expect(result!.status).toBe(ProjetoStatus.publicado);
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
      repository.findById.mockResolvedValue(makeProject());
      manuscriptPort.summaries.mockRejectedValue(new Error('IMP unavailable'));
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.history.mockResolvedValue([]);

      await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('degraded:true port=ManuscriptSummaryPort'),
      );
    });

    it('emits WARN with degraded:true port=PublicationHistoryPort when PUB port throws', async () => {
      repository.findById.mockResolvedValue(makeProject());
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.history.mockRejectedValue(new Error('PUB unavailable'));

      await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('degraded:true port=PublicationHistoryPort'),
      );
    });

    it('does NOT emit WARN when all ports succeed', async () => {
      repository.findById.mockResolvedValue(makeProject());
      manuscriptPort.summaries.mockResolvedValue(new Map());
      metadataPort.metadata.mockResolvedValue(new Map());
      publicationPort.history.mockResolvedValue([]);

      await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });
  });
});
