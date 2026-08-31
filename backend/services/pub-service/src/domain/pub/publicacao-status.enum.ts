/**
 * Async build-machine state of a `Publicacao` (ADR-002-async-build-status-machine).
 *
 * `gerando -> validando -> publicado | com_erros`. Independent from
 * `EpubcheckStatus`, which carries the epubcheck verdict (D-Q).
 */
export enum PublicacaoStatus {
  GERANDO = 'gerando',
  VALIDANDO = 'validando',
  PUBLICADO = 'publicado',
  COM_ERROS = 'com_erros',
}
