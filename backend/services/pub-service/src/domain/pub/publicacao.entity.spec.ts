import { EpubcheckStatus } from './epubcheck-status.enum';
import { PublicacaoEntity } from './publicacao.entity';
import { PublicacaoStatus } from './publicacao-status.enum';

describe('PublicacaoEntity', () => {
  const publicacaoId = '11111111-1111-1111-1111-111111111111';
  const projetoId = '22222222-2222-2222-2222-222222222222';
  const iniciadaEm = new Date('2026-08-19T16:30:00Z');

  it('starts a new attempt in gerando/pendente with no artifact', () => {
    const publicacao = PublicacaoEntity.iniciar({
      id: publicacaoId,
      projetoId,
      sequencia: 1,
      iniciadaEm,
    });

    expect(publicacao.status).toBe(PublicacaoStatus.GERANDO);
    expect(publicacao.epubcheckStatus).toBe(EpubcheckStatus.PENDENTE);
    expect(publicacao.arquivoDisponivel()).toBe(false);
    expect(publicacao.isTerminal()).toBe(false);
    expect(publicacao.artefatoRef).toBeUndefined();
  });

  it('transitions gerando -> validando -> publicado with warnings only (D-Q)', () => {
    const publicacao = PublicacaoEntity.iniciar({ id: publicacaoId, projetoId, sequencia: 1, iniciadaEm })
      .iniciarValidacao()
      .concluirPublicado({
        artefatoRef: 'emp_aetos/romance-v1.epub',
        epubcheckStatus: EpubcheckStatus.AVISOS,
        totalErros: 0,
        totalAvisos: 2,
        concluidaEm: new Date('2026-08-19T16:31:00Z'),
      });

    expect(publicacao.status).toBe(PublicacaoStatus.PUBLICADO);
    expect(publicacao.epubcheckStatus).toBe(EpubcheckStatus.AVISOS);
    expect(publicacao.arquivoDisponivel()).toBe(true);
    expect(publicacao.isTerminal()).toBe(true);
    expect(publicacao.artefatoRef).toBe('emp_aetos/romance-v1.epub');
  });

  it('transitions gerando -> validando -> com_erros with no artifact', () => {
    const publicacao = PublicacaoEntity.iniciar({ id: publicacaoId, projetoId, sequencia: 1, iniciadaEm })
      .iniciarValidacao()
      .concluirComErros({
        resumoErro: 'RSC-005: invalid OPF reference',
        totalErros: 1,
        totalAvisos: 0,
        concluidaEm: new Date('2026-08-19T16:31:00Z'),
      });

    expect(publicacao.status).toBe(PublicacaoStatus.COM_ERROS);
    expect(publicacao.epubcheckStatus).toBe(EpubcheckStatus.ERROS_CRITICOS);
    expect(publicacao.arquivoDisponivel()).toBe(false);
    expect(publicacao.isTerminal()).toBe(true);
    expect(publicacao.artefatoRef).toBeUndefined();
  });

  it('rejects concluirPublicado from a non-validando status', () => {
    const publicacao = PublicacaoEntity.iniciar({ id: publicacaoId, projetoId, sequencia: 1, iniciadaEm });

    expect(() =>
      publicacao.concluirPublicado({
        artefatoRef: 'x',
        epubcheckStatus: EpubcheckStatus.VALIDO,
        totalErros: 0,
        totalAvisos: 0,
        concluidaEm: new Date(),
      }),
    ).toThrow(/cannot concluirPublicado/);
  });

  it('rejects concluirComErros from a non-validando status', () => {
    const publicacao = PublicacaoEntity.iniciar({ id: publicacaoId, projetoId, sequencia: 1, iniciadaEm });

    expect(() =>
      publicacao.concluirComErros({
        resumoErro: 'boom',
        totalErros: 1,
        totalAvisos: 0,
        concluidaEm: new Date(),
      }),
    ).toThrow(/cannot concluirComErros/);
  });

  it('rejects a publicado instance without an artefatoRef (chk_publicacao_artefato)', () => {
    expect(
      () =>
        new PublicacaoEntity({
          id: publicacaoId,
          projetoId,
          status: PublicacaoStatus.PUBLICADO,
          epubcheckStatus: EpubcheckStatus.VALIDO,
          sequencia: 1,
          totalErros: 0,
          totalAvisos: 0,
          iniciadaEm,
        }),
    ).toThrow(/artefatoRef/);
  });

  it('rejects sequencia below 1 (chk_publicacao_sequencia)', () => {
    expect(() =>
      PublicacaoEntity.iniciar({ id: publicacaoId, projetoId, sequencia: 0, iniciadaEm }),
    ).toThrow(/sequencia/);
  });
});
