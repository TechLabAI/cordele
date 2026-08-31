import type { Prisma, Publicacao as PublicacaoModel } from '@prisma/client';

import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../domain/pub/publicacao-status.enum';

/**
 * Translates between the `Publicacao` Prisma model and `PublicacaoEntity`.
 *
 * This is the ONLY file allowed to know both the Prisma row shape and the
 * domain entity shape. Explicit field mapping (no spreads) means a schema
 * rename surfaces here as a compile error rather than a silent `undefined`
 * deep in domain logic (RULE-01/02 — domain/ never sees @prisma/client).
 */
export class PublicacaoMapper {
  /**
   * Maps a Prisma `Publicacao` row to the domain `PublicacaoEntity`.
   *
   * The entity enforces its own invariants in the constructor, so any row
   * that violates them (e.g. status/artefatoRef constraint) throws here — a
   * loud failure beats a silent wrong state.
   */
  static toDomain(model: PublicacaoModel): PublicacaoEntity {
    return new PublicacaoEntity({
      id: model.id,
      projetoId: model.projetoId,
      status: model.status as PublicacaoStatus,
      epubcheckStatus: model.epubcheckStatus as EpubcheckStatus,
      sequencia: model.sequencia,
      artefatoRef: model.artefatoRef ?? undefined,
      resumoErro: model.resumoErro ?? undefined,
      totalErros: model.totalErros,
      totalAvisos: model.totalAvisos,
      iniciadaEm: model.iniciadaEm,
      concluidaEm: model.concluidaEm ?? undefined,
    });
  }

  /** Convenience helper: maps a list of rows. */
  static toDomainList(models: PublicacaoModel[]): PublicacaoEntity[] {
    return models.map((m) => PublicacaoMapper.toDomain(m));
  }

  /**
   * Converts the domain entity to a Prisma CREATE input.
   *
   * Used by `save()` when inserting a new `Publicacao` (append-only: a
   * new export attempt is always a new row).
   */
  static toCreateInput(entity: PublicacaoEntity): Prisma.PublicacaoUncheckedCreateInput {
    return {
      id: entity.id,
      projetoId: entity.projetoId,
      status: entity.status,
      epubcheckStatus: entity.epubcheckStatus,
      sequencia: entity.sequencia,
      artefatoRef: entity.artefatoRef ?? null,
      resumoErro: entity.resumoErro ?? null,
      totalErros: entity.totalErros,
      totalAvisos: entity.totalAvisos,
      iniciadaEm: entity.iniciadaEm,
      concluidaEm: entity.concluidaEm ?? null,
    };
  }

  /**
   * Converts the domain entity to a Prisma UPDATE input.
   *
   * Only the mutable columns are included (the in-flight row transitions
   * gerando → validando → terminal; `sequencia` and `projetoId` are fixed).
   */
  static toUpdateInput(entity: PublicacaoEntity): Prisma.PublicacaoUncheckedUpdateInput {
    return {
      status: entity.status,
      epubcheckStatus: entity.epubcheckStatus,
      artefatoRef: entity.artefatoRef ?? null,
      resumoErro: entity.resumoErro ?? null,
      totalErros: entity.totalErros,
      totalAvisos: entity.totalAvisos,
      concluidaEm: entity.concluidaEm ?? null,
    };
  }
}
