/**
 * Unit tests for GetPublicationHistoryUseCase (PROJ-012).
 */

import { NotFoundException } from '@nestjs/common';
import { GetPublicationHistoryUseCase } from './get-publication-history.use-case';
import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

const NOW_STR = '2026-08-25T10:00:00Z';
const NOW = new Date(NOW_STR);
const PROJETO_ID = 'proj-uuid-1';
const EMPRESA_ID = 'emp-aetos';

function makeProject() {
  return {
    id: PROJETO_ID,
    nome: 'Meu Projeto',
    descricao: null,
    editoraId: EMPRESA_ID,
    status: ProjetoStatus.com_erros,
    criadoEm: NOW,
    atualizadoEm: NOW,
  };
}

describe('GetPublicationHistoryUseCase', () => {
  let repository: jest.Mocked<ProjetoEditorialRepository>;
  let publicationPort: jest.Mocked<PublicationHistoryPort>;
  let useCase: GetPublicationHistoryUseCase;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
    } as unknown as jest.Mocked<ProjetoEditorialRepository>;

    publicationPort = {
      latest: jest.fn(),
      history: jest.fn(),
      signedDownloadUrl: jest.fn(),
    } as jest.Mocked<PublicationHistoryPort>;

    useCase = new GetPublicationHistoryUseCase(repository, publicationPort);
  });

  it('throws NotFoundException for unknown or cross-tenant project', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projetoId: 'unknown', empresaId: EMPRESA_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns history ordered newest-first (as delivered by port)', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([
      {
        publicacaoId: 'pub-2',
        projetoId: PROJETO_ID,
        epubcheckStatus: 'avisos',
        totalErros: 0,
        totalAvisos: 2,
        criadoEm: '2026-06-19T16:30:00Z',
      },
      {
        publicacaoId: 'pub-1',
        projetoId: PROJETO_ID,
        epubcheckStatus: 'erros_criticos',
        totalErros: 3,
        totalAvisos: 0,
        criadoEm: '2026-06-14T09:15:00Z',
      },
    ]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result).toHaveLength(2);
    // First item is newest
    expect(result[0].publicacaoId).toBe('pub-2');
    expect(result[0].epubcheckStatus).toBe('avisos');
    // arquivoUrl present for avisos
    expect(result[0].arquivoUrl).toBeNull(); // no URL from mock
  });

  it('sets arquivoUrl=null for erros_criticos publications', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([
      {
        publicacaoId: 'pub-bad',
        projetoId: PROJETO_ID,
        epubcheckStatus: 'erros_criticos',
        totalErros: 5,
        totalAvisos: 0,
        arquivoUrl: 'should-be-stripped',
        criadoEm: '2026-06-14T09:15:00Z',
      },
    ]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result[0].arquivoUrl).toBeNull();
  });

  it('sets arquivoUrl=null for pendente publications', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([
      {
        publicacaoId: 'pub-pending',
        projetoId: PROJETO_ID,
        epubcheckStatus: 'pendente',
        totalErros: 0,
        totalAvisos: 0,
        criadoEm: '2026-07-01T00:00:00Z',
      },
    ]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result[0].arquivoUrl).toBeNull();
  });

  it('returns empty array when project exists but has no publications', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([]);

    const result = await useCase.execute({ projetoId: PROJETO_ID, empresaId: EMPRESA_ID });

    expect(result).toEqual([]);
  });
});
