/**
 * Shared BDD fixture helper — DataTable seed for `publicacao` rows (P8 / PUB-019).
 *
 * Exported and called by step-files that need the step
 * `project {string} has the following publicacoes:`.
 *
 * Pitfall mitigated (bdd-scaffold:cucumber-expression:escaped-quote-not-supported):
 * step text uses `{string}` placeholder — never escaped quotes.
 *
 * DataTable note: jest-cucumber passes DataTable rows as a plain
 * `Record<string, string>[]` array (hashed with header row), not as a
 * DataTable object. Use the array directly — do NOT call `.hashes()`.
 */
import { PublicacaoEntity } from 'src/domain/pub/publicacao.entity';
import { EpubcheckStatus } from 'src/domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from 'src/domain/pub/publicacao-status.enum';

import { getCurrentContext } from './test-context';

/**
 * Type for a jest-cucumber DataTable argument.
 * jest-cucumber passes table rows with headers as a plain array of objects —
 * NOT a DataTable class with `.hashes()`. Use `rows` directly.
 */
export type BddDataTable = Record<string, string>[];

/**
 * Seeds publicacao rows from a Gherkin DataTable into the in-memory repository.
 *
 * Expected columns (all optional except `status` and `epubcheckStatus`):
 *  - `status`          — PublicacaoStatus value (required)
 *  - `epubcheckStatus` — EpubcheckStatus value (required)
 *  - `sequencia`       — integer; auto-assigned (1, 2, 3, …) when absent
 *  - `artefatoRef`     — storage key; auto-generated for `publicado` rows if absent
 *
 * A `publicado` row without an explicit `artefatoRef` gets a synthetic key so
 * the domain invariant (`artefatoRef` ↔ `publicado`) is never violated.
 */
export function seedPublicacoesFromDataTable(projetoId: string, rows: Record<string, string>[]): void {
  const ctx = getCurrentContext();
  let autoSeq = 1;

  for (const row of rows) {
    const status = row['status'] as PublicacaoStatus;
    const epubcheckStatus = row['epubcheckStatus'] as EpubcheckStatus;
    const sequencia = row['sequencia'] ? parseInt(row['sequencia'], 10) : autoSeq;
    autoSeq = sequencia + 1;

    const artefatoRef =
      row['artefatoRef'] ??
      (status === PublicacaoStatus.PUBLICADO
        ? `publicacoes/seed-${projetoId}-seq${sequencia}/output.epub`
        : undefined);

    const entity = new PublicacaoEntity({
      id: `pub-seed-${projetoId}-seq${sequencia}`,
      projetoId,
      status,
      epubcheckStatus,
      sequencia,
      artefatoRef,
      totalErros: status === PublicacaoStatus.COM_ERROS ? 1 : 0,
      totalAvisos: epubcheckStatus === EpubcheckStatus.AVISOS ? 1 : 0,
      iniciadaEm: new Date(Date.now() - sequencia * 60_000), // older rows have earlier timestamps
    });
    ctx.inMemoryRepo.save(entity);
  }
}
