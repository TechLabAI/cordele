import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type FileStoragePort } from '../ports/file-storage.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GetSignedDownloadUrlUseCase } from './get-signed-download-url.use-case';

const PROJETO_ID = 'p1';
const PUBLICACAO_ID = 'pub1';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId: 'empresa-aetos',
});

const makePublicado = (epubcheckStatus: EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id: PUBLICACAO_ID, projetoId: PROJETO_ID, sequencia: 1, iniciadaEm: new Date() })
    .iniciarValidacao()
    .concluirPublicado({
      artefatoRef: 'publicacoes/pub1/output.epub',
      epubcheckStatus,
      totalErros: 0,
      totalAvisos: epubcheckStatus === EpubcheckStatus.AVISOS ? 1 : 0,
      concluidaEm: new Date(),
    });

describe('GetSignedDownloadUrlUseCase', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let fileStoragePort: jest.Mocked<FileStoragePort>;
  let useCase: GetSignedDownloadUrlUseCase;

  beforeEach(() => {
    repository = {
      findInFlight: jest.fn(),
      nextSequencia: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      listByProjeto: jest.fn(),
      findLatestByProjetoIds: jest.fn(),
      findByPublicacaoId: jest.fn(),
      deleteAllByProjeto: jest.fn(),
      findStaleInFlight: jest.fn(),
    };
    fileStoragePort = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      signUrl: jest.fn(),
    };
    useCase = new GetSignedDownloadUrlUseCase(repository, fileStoragePort);
  });

  it('throws ForbiddenException when the caller carries no empresa claim', async () => {
    await expect(
      useCase.execute(
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID },
        { ...makeUser(), empresaId: '' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the publicacao does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID }, makeUser()),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException for a com_erros publication (no artifact)', async () => {
    const comErros = PublicacaoEntity.iniciar({
      id: PUBLICACAO_ID,
      projetoId: PROJETO_ID,
      sequencia: 1,
      iniciadaEm: new Date(),
    })
      .iniciarValidacao()
      .concluirComErros({ resumoErro: 'boom', totalErros: 1, totalAvisos: 0, concluidaEm: new Date() });
    repository.findById.mockResolvedValue(comErros);

    await expect(
      useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID }, makeUser()),
    ).rejects.toThrow(ConflictException);
    expect(fileStoragePort.signUrl).not.toHaveBeenCalled();
  });

  it('mints a signed URL for a valido publication', async () => {
    repository.findById.mockResolvedValue(makePublicado(EpubcheckStatus.VALIDO));
    fileStoragePort.signUrl.mockResolvedValue({ url: 'https://storage/output.epub?sig=x', expiresAt: '2026-08-19T16:35:00Z' });

    const result = await useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID }, makeUser());

    expect(fileStoragePort.signUrl).toHaveBeenCalledWith('publicacoes/pub1/output.epub', 300);
    expect(result).toEqual({
      publicacaoId: PUBLICACAO_ID,
      arquivoUrl: 'https://storage/output.epub?sig=x',
      expiresAt: '2026-08-19T16:35:00Z',
    });
  });

  it('mints a signed URL for an avisos publication too (warnings do not block download, D-Q)', async () => {
    repository.findById.mockResolvedValue(makePublicado(EpubcheckStatus.AVISOS));
    fileStoragePort.signUrl.mockResolvedValue({ url: 'https://storage/output.epub?sig=y', expiresAt: '2026-08-19T16:35:00Z' });

    const result = await useCase.execute({ projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID }, makeUser());

    expect(result.arquivoUrl).toBe('https://storage/output.epub?sig=y');
  });
});
