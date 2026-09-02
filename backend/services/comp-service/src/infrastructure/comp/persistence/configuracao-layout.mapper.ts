import type {
  ConfiguracaoLayout as ConfiguracaoLayoutModel,
  LayoutOverride as LayoutOverrideModel,
} from '../../prisma-client';

import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride, type OverrideTipo, type Alinhamento } from '../../../domain/comp/layout-override.entity';

type ConfiguracaoLayoutWithOverrides = ConfiguracaoLayoutModel & { overrides: LayoutOverrideModel[] };

/**
 * Translates between Prisma models and domain aggregates for ConfiguracaoLayout.
 *
 * The new `ConfiguracaoLayout` aggregate uses flat snake_case fields (fonte_corpo_familia,
 * fonte_corpo_tamanho, etc.) that map directly to the Prisma model's camelCase aliases
 * (fonteCorpoFamilia, fonteCorpoTamanho, etc.).
 *
 * `LayoutOverride` uses `referenciaNo` (matching the Prisma column `referencia_no`).
 *
 * RULE-01: ConfiguracaoLayout aggregate does not import @prisma/client — this is the bridge.
 */
export class ConfiguracaoLayoutMapper {
  /**
   * Maps a Prisma row (with its overrides relation included) to the domain aggregate.
   *
   * @param model       Prisma ConfiguracaoLayout row with overrides
   * @param empresaSlug Slug of the owning tenant
   */
  static toDomain(
    model: ConfiguracaoLayoutWithOverrides,
    empresaSlug: string,
  ): ConfiguracaoLayout {
    const overrides = model.overrides.map(ConfiguracaoLayoutMapper.overrideToDomain);

    return new ConfiguracaoLayout({
      id: model.id,
      projetoId: model.projetoId,
      fonte_corpo_familia: model.fonteCorpoFamilia as 'serif' | 'sans-serif',
      fonte_corpo_tamanho: model.fonteCorpoTamanho,
      // Prisma returns Decimal for NUMERIC columns — coerce to number for the domain
      espacamento_linha: Number(model.espacamentoLinha),
      margem_lateral: model.margemLateral,
      h1_tamanho: model.h1Tamanho,
      h2_tamanho: model.h2Tamanho,
      h3_tamanho: model.h3Tamanho,
      overrides,
      atualizadoEm: model.atualizadoEm,
      empresaSlug,
      materialized: true,
    });
  }

  /**
   * Maps a Prisma `LayoutOverride` row to the domain entity.
   *
   * Overrides with `tipo='em-branco'` in the DB are coerced to stale placeholders
   * because the MVP application layer rejects them on write (D-H).
   */
  static overrideToDomain(model: LayoutOverrideModel): LayoutOverride {
    if (model.tipo === 'em-branco') {
      // em-branco is reserved/deferred (D-H). Coerce to a stale imagem override so
      // the LayoutOverride constructor does not throw, but stale=true flags it.
      return new LayoutOverride({
        id: model.id,
        referenciaNo: model.referenciaNo,
        tipo: 'imagem',
        alinhamento: (model.alinhamento as Alinhamento | null) ?? 'full',
        ordem: model.ordem,
        stale: true,
      });
    }

    return new LayoutOverride({
      id: model.id,
      referenciaNo: model.referenciaNo,
      tipo: model.tipo as OverrideTipo,
      alinhamento: (model.alinhamento as Alinhamento | null) ?? null,
      ordem: model.ordem,
      stale: false,
    });
  }

  /**
   * Maps a `LayoutOverride` domain entity to Prisma createMany input.
   *
   * Used by `upsert` (override replacement step).
   * `id` is omitted — DB generates a new UUID on insert.
   */
  static overrideToCreateInput(
    override: LayoutOverride,
    configuracaoLayoutId: string,
  ): Omit<LayoutOverrideModel, 'id'> {
    return {
      configuracaoLayoutId,
      referenciaNo: override.referenciaNo,
      tipo: override.tipo,
      alinhamento: override.alinhamento ?? null,
      ordem: override.ordem,
    };
  }

  /**
   * Maps domain fields to Prisma create input for an upsert.
   * Overrides are managed separately via the $transaction in `upsert`.
   */
  static toUpsertCreateInput(
    entity: ConfiguracaoLayout,
  ): Omit<ConfiguracaoLayoutModel, 'id' | 'atualizadoEm'> & { id?: string; atualizadoEm?: Date } {
    return {
      ...(entity.id ? { id: entity.id } : {}),
      projetoId: entity.projetoId,
      fonteCorpoFamilia: entity.fonte_corpo_familia,
      fonteCorpoTamanho: entity.fonte_corpo_tamanho,
      // Prisma expects a Decimal-compatible value; the number is accepted by the ORM
      espacamentoLinha: entity.espacamento_linha as unknown as ConfiguracaoLayoutModel['espacamentoLinha'],
      margemLateral: entity.margem_lateral,
      h1Tamanho: entity.h1_tamanho,
      h2Tamanho: entity.h2_tamanho,
      h3Tamanho: entity.h3_tamanho,
      atualizadoEm: entity.atualizadoEm,
    };
  }

  /** Mutable fields for the update arm of the upsert. */
  static toUpsertUpdateInput(
    entity: ConfiguracaoLayout,
  ): Partial<Omit<ConfiguracaoLayoutModel, 'id' | 'projetoId'>> {
    return {
      fonteCorpoFamilia: entity.fonte_corpo_familia,
      fonteCorpoTamanho: entity.fonte_corpo_tamanho,
      espacamentoLinha: entity.espacamento_linha as unknown as ConfiguracaoLayoutModel['espacamentoLinha'],
      margemLateral: entity.margem_lateral,
      h1Tamanho: entity.h1_tamanho,
      h2Tamanho: entity.h2_tamanho,
      h3Tamanho: entity.h3_tamanho,
      atualizadoEm: entity.atualizadoEm,
    };
  }
}
