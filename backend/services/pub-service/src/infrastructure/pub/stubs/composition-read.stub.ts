import { Injectable } from '@nestjs/common';

import type { CompositionMetadataPort, MetadadosRead } from '../../../modules/pub/ports/composition-metadata.port';
import type { CompositionLayoutPort, LayoutRead } from '../../../modules/pub/ports/composition-layout.port';

/**
 * In-process stub for CompositionMetadataPort (PUB-012, P4).
 *
 * Returns fixture metadados with `titulo`, `autor`, and `idioma` so the
 * export pre-flight (api-contract §7.1 checks) passes. Return `null` when
 * `PUB_METADADOS_STUB_NULL=true` to exercise the 422 metadata-incomplete
 * rejection path.
 */
@Injectable()
export class CompositionMetadataStub implements CompositionMetadataPort {
  async get(projetoId: string): Promise<MetadadosRead | null> {
    if (process.env['PUB_METADADOS_STUB_NULL'] === 'true') {
      return null;
    }

    return {
      projetoId,
      titulo: 'Livro Stub',
      autor: 'Autor Stub',
      isbn: null,
      idioma: 'pt-BR',
      categoria: null,
      capaUrl: null,
      editoraNome: null,
      atualizadoEm: new Date(0).toISOString(),
    };
  }
}

/**
 * In-process stub for CompositionLayoutPort (PUB-012, P4).
 *
 * Always returns the COMP-documented defaults (comp api-contract §7.2).
 * `null` is not needed here: the domain falls back to defaults when layout
 * is absent, and the pre-flight does not reject on missing layout.
 */
@Injectable()
export class CompositionLayoutStub implements CompositionLayoutPort {
  async get(projetoId: string): Promise<LayoutRead | null> {
    return {
      projetoId,
      fonteCorpoFamilia: 'serif',
      fonteCorpoTamanho: 12,
      espacamentoLinha: 1.5,
      margemLateral: 20,
      h1Tamanho: 24,
      h2Tamanho: 20,
      h3Tamanho: 16,
      overrides: [],
    };
  }
}
