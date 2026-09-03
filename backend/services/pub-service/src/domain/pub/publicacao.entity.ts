import { EpubcheckStatus } from './epubcheck-status.enum';
import { PublicacaoStatus } from './publicacao-status.enum';

export interface PublicacaoProps {
  readonly id: string;
  readonly projetoId: string;
  readonly status: PublicacaoStatus;
  readonly epubcheckStatus: EpubcheckStatus;
  readonly sequencia: number;
  readonly artefatoRef?: string;
  readonly resumoErro?: string;
  readonly totalErros: number;
  readonly totalAvisos: number;
  readonly iniciadaEm: Date;
  readonly concluidaEm?: Date;
  /** Tamanho do arquivo .epub em bytes (ADR-004). Nulo até status=publicado. */
  readonly tamanhoBytes?: number;
  /** Número de capítulos no ePub gerado (ADR-004). Nulo até status=publicado. */
  readonly totalCapitulos?: number;
  /** Número de imagens referenciadas no ePub gerado (ADR-004). Nulo até status=publicado. */
  readonly totalImagens?: number;
}

/**
 * `Publicacao` aggregate root — one ePub export attempt (PUB context,
 * data-model.md §2.1).
 *
 * Carries two independent status fields (api-contract §0 D-Q): `status` is
 * the async build-machine state (`gerando -> validando -> publicado |
 * com_erros`, ADR-002), `epubcheckStatus` is the epubcheck verdict
 * (ADR-003). Append-only history: a terminal instance is never mutated in
 * place — every transition returns a new instance. Pure domain object: zero
 * `@nestjs/*` and zero `@prisma/client` (RULE-01/02).
 */
export class PublicacaoEntity {
  readonly id: string;
  readonly projetoId: string;
  readonly status: PublicacaoStatus;
  readonly epubcheckStatus: EpubcheckStatus;
  readonly sequencia: number;
  readonly artefatoRef?: string;
  readonly resumoErro?: string;
  readonly totalErros: number;
  readonly totalAvisos: number;
  readonly iniciadaEm: Date;
  readonly concluidaEm?: Date;
  /** Tamanho do arquivo .epub em bytes (ADR-004). Nulo até status=publicado. */
  readonly tamanhoBytes?: number;
  /** Número de capítulos no ePub gerado (ADR-004). Nulo até status=publicado. */
  readonly totalCapitulos?: number;
  /** Número de imagens referenciadas no ePub gerado (ADR-004). Nulo até status=publicado. */
  readonly totalImagens?: number;

  constructor(props: PublicacaoProps) {
    PublicacaoEntity.assertInvariants(props);
    this.id = props.id;
    this.projetoId = props.projetoId;
    this.status = props.status;
    this.epubcheckStatus = props.epubcheckStatus;
    this.sequencia = props.sequencia;
    this.artefatoRef = props.artefatoRef;
    this.resumoErro = props.resumoErro;
    this.totalErros = props.totalErros;
    this.totalAvisos = props.totalAvisos;
    this.iniciadaEm = props.iniciadaEm;
    this.concluidaEm = props.concluidaEm;
    this.tamanhoBytes = props.tamanhoBytes;
    this.totalCapitulos = props.totalCapitulos;
    this.totalImagens = props.totalImagens;
  }

  /** Starts a new build attempt (D-N): status=gerando, epubcheckStatus=pendente. */
  static iniciar(props: {
    id: string;
    projetoId: string;
    sequencia: number;
    iniciadaEm: Date;
  }): PublicacaoEntity {
    return new PublicacaoEntity({
      id: props.id,
      projetoId: props.projetoId,
      status: PublicacaoStatus.GERANDO,
      epubcheckStatus: EpubcheckStatus.PENDENTE,
      sequencia: props.sequencia,
      totalErros: 0,
      totalAvisos: 0,
      iniciadaEm: props.iniciadaEm,
    });
  }

  /** `gerando -> validando`, once the OCF/ePub package has been assembled. */
  iniciarValidacao(): PublicacaoEntity {
    this.assertStatus(PublicacaoStatus.GERANDO, 'iniciarValidacao');
    return new PublicacaoEntity({ ...this.toProps(), status: PublicacaoStatus.VALIDANDO });
  }

  /**
   * `validando -> publicado`. Warnings do not block publication (D-Q): an
   * `avisos` epubcheck verdict still yields a downloadable artifact.
   *
   * ADR-004: os campos `tamanhoBytes`, `totalCapitulos` e `totalImagens` são
   * preenchidos apenas nesta transição — ficam nulos nas demais.
   */
  concluirPublicado(outcome: {
    artefatoRef: string;
    epubcheckStatus: EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS;
    totalErros: number;
    totalAvisos: number;
    concluidaEm: Date;
    tamanhoBytes?: number;
    totalCapitulos?: number;
    totalImagens?: number;
  }): PublicacaoEntity {
    this.assertStatus(PublicacaoStatus.VALIDANDO, 'concluirPublicado');
    return new PublicacaoEntity({
      ...this.toProps(),
      status: PublicacaoStatus.PUBLICADO,
      epubcheckStatus: outcome.epubcheckStatus,
      artefatoRef: outcome.artefatoRef,
      totalErros: outcome.totalErros,
      totalAvisos: outcome.totalAvisos,
      concluidaEm: outcome.concluidaEm,
      tamanhoBytes: outcome.tamanhoBytes,
      totalCapitulos: outcome.totalCapitulos,
      totalImagens: outcome.totalImagens,
    });
  }

  /** `validando -> com_erros`. A rejected build never produces an artifact. */
  concluirComErros(outcome: {
    resumoErro: string;
    totalErros: number;
    totalAvisos: number;
    concluidaEm: Date;
  }): PublicacaoEntity {
    this.assertStatus(PublicacaoStatus.VALIDANDO, 'concluirComErros');
    return new PublicacaoEntity({
      ...this.toProps(),
      status: PublicacaoStatus.COM_ERROS,
      epubcheckStatus: EpubcheckStatus.ERROS_CRITICOS,
      resumoErro: outcome.resumoErro,
      totalErros: outcome.totalErros,
      totalAvisos: outcome.totalAvisos,
      concluidaEm: outcome.concluidaEm,
    });
  }

  isTerminal(): boolean {
    return this.status === PublicacaoStatus.PUBLICADO || this.status === PublicacaoStatus.COM_ERROS;
  }

  /** `true` only when `status=publicado` (`arquivoDisponivel`, api-contract §6.1). */
  arquivoDisponivel(): boolean {
    return this.status === PublicacaoStatus.PUBLICADO;
  }

  private assertStatus(expected: PublicacaoStatus, operation: string): void {
    if (this.status !== expected) {
      throw new Error(
        `PublicacaoEntity: cannot ${operation} from status ${this.status} (expected ${expected})`,
      );
    }
  }

  private toProps(): PublicacaoProps {
    return {
      id: this.id,
      projetoId: this.projetoId,
      status: this.status,
      epubcheckStatus: this.epubcheckStatus,
      sequencia: this.sequencia,
      artefatoRef: this.artefatoRef,
      resumoErro: this.resumoErro,
      totalErros: this.totalErros,
      totalAvisos: this.totalAvisos,
      iniciadaEm: this.iniciadaEm,
      concluidaEm: this.concluidaEm,
      tamanhoBytes: this.tamanhoBytes,
      totalCapitulos: this.totalCapitulos,
      totalImagens: this.totalImagens,
    };
  }

  private static assertInvariants(props: PublicacaoProps): void {
    if (!props.id) {
      throw new Error('PublicacaoEntity: id is required');
    }
    if (!props.projetoId) {
      throw new Error('PublicacaoEntity: projetoId is required');
    }
    if (props.sequencia < 1) {
      throw new Error('PublicacaoEntity: sequencia must be >= 1 (chk_publicacao_sequencia)');
    }
    if (props.totalErros < 0 || props.totalAvisos < 0) {
      throw new Error('PublicacaoEntity: totalErros/totalAvisos must be >= 0 (chk_publicacao_counts)');
    }
    const hasArtefato = props.artefatoRef !== undefined && props.artefatoRef !== null;
    if ((props.status === PublicacaoStatus.PUBLICADO) !== hasArtefato) {
      throw new Error(
        'PublicacaoEntity: artefatoRef must be set if and only if status is publicado (chk_publicacao_artefato)',
      );
    }
  }
}
