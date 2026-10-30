/**
 * Unit tests for GetSignedDownloadUrlUseCase (PROJ-013).
 *
 * Verified behaviours:
 *  1. Returns signed URL for valido publication.
 *  2. Returns signed URL for avisos publication.
 *  3. 409 ConflictException for erros_criticos.
 *  4. 409 ConflictException for pendente.
 *  5. 404 NotFoundException when publicacaoId not in project's history.
 *  6. 404 NotFoundException when project is cross-tenant/non-existent.
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { GetSignedDownloadUrlUseCase } from './get-signed-download-url.use-case';
import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

const NOW = new Date('2026-08-25T10:00:00Z');
const PROJETO_ID = 'proj-uuid-1';
const EMPRESA_ID = 'emp-aetos';
const PUB_ID = 'pub-uuid-1';

function makeProject() {
  return {
    id: PROJETO_ID,
    nome: 'Meu Projeto',
    descricao: null,
    editoraId: EMPRESA_ID,
    status: ProjetoStatus.publicado,
    criadoEm: NOW,
    atualizadoEm: NOW,
  };
}

function makeRecord(status: string) {
  return {
    publicacaoId: PUB_ID,
    projetoId: PROJETO_ID,
    epubcheckStatus: status as any,
    totalErros: status === 'erros_criticos' ? 3 : 0,
    totalAvisos: status === 'avisos' ? 2 : 0,
    criadoEm: NOW.toISOString(),
  };
}

describe('GetSignedDownloadUrlUseCase', () => {
  let repository: jest.Mocked<ProjetoEditorialRepository>;
  let publicationPort: jest.Mocked<PublicationHistoryPort>;
  let useCase: GetSignedDownloadUrlUseCase;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ProjetoEditorialRepository>;

    publicationPort = {
      latest: jest.fn(),
      history: jest.fn(),
      signedDownloadUrl: jest.fn(),
    } as jest.Mocked<PublicationHistoryPort>;

    useCase = new GetSignedDownloadUrlUseCase(repository, publicationPort);
  });

  it('throws NotFoundException when project does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when publicacaoId not in project history', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([]);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: 'other-pub', empresaId: EMPRESA_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) for erros_criticos publication', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([makeRecord('erros_criticos')]);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException (409) for pendente publication', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([makeRecord('pendente')]);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns signed URL for valido publication', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([makeRecord('valido')]);
    publicationPort.signedDownloadUrl.mockResolvedValue({
      arquivoUrl: 'https://storage.example.com/romance.epub?sig=abc',
      expiresAt: '2026-08-25T15:00:00Z',
    });

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      publicacaoId: PUB_ID,
      empresaId: EMPRESA_ID,
    });

    expect(result.publicacaoId).toBe(PUB_ID);
    expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=abc');
    expect(result.expiresAt).toBe('2026-08-25T15:00:00Z');
    // Port called exactly once, after status validation
    expect(publicationPort.signedDownloadUrl).toHaveBeenCalledTimes(1);
    // projetoId is now the second arg (Problem 3 fix: port signature includes projetoId)
    // bearerToken=undefined since the test input has no bearerToken
    expect(publicationPort.signedDownloadUrl).toHaveBeenCalledWith(PUB_ID, PROJETO_ID, EMPRESA_ID, undefined);
  });

  it('returns signed URL for avisos publication', async () => {
    repository.findById.mockResolvedValue(makeProject());
    publicationPort.history.mockResolvedValue([makeRecord('avisos')]);
    publicationPort.signedDownloadUrl.mockResolvedValue({
      arquivoUrl: 'https://storage.example.com/novela.epub?sig=xyz',
      expiresAt: '2026-08-25T15:05:00Z',
    });

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      publicacaoId: PUB_ID,
      empresaId: EMPRESA_ID,
    });

    expect(result.arquivoUrl).toBe('https://storage.example.com/novela.epub?sig=xyz');
  });
});
