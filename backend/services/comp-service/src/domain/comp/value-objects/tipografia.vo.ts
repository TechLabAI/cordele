import { DomainException } from '../../shared/domain-exception';

/**
 * Typography bounds value objects and validators for the COMP domain.
 *
 * All VOs are plain classes — no @nestjs/* or @prisma/client (RULE-01/02).
 * Bounds mirror data-model §2.2 CHECK constraints (DB is the backstop; domain
 * is the first line of defence — defense-in-depth, D-M).
 *
 * COMP-006: extracted to a reusable module so ConfiguracaoLayout aggregate and
 * any future aggregates can share the same validated types.
 */

// ---------------------------------------------------------------------------
// FonteCorpo — font size 12..20 px
// ---------------------------------------------------------------------------

export class FonteCorpo {
  readonly value: number;

  constructor(value: number) {
    if (value < 12 || value > 20) {
      throw new DomainException(
        'FONTE_CORPO_TAMANHO_INVALIDO',
        422,
        `fonte_corpo_tamanho must be between 12 and 20 (received ${value})`,
      );
    }
    this.value = value;
  }
}

// ---------------------------------------------------------------------------
// EspacamentoLinha — line spacing 1.2..2.0
// ---------------------------------------------------------------------------

export class EspacamentoLinha {
  readonly value: number;

  constructor(value: number) {
    if (value < 1.2 || value > 2.0) {
      throw new DomainException(
        'ESPACAMENTO_LINHA_INVALIDO',
        422,
        `espacamento_linha must be between 1.2 and 2.0 (received ${value})`,
      );
    }
    this.value = value;
  }
}

// ---------------------------------------------------------------------------
// MargemLateral — page margin 10..40 mm
// ---------------------------------------------------------------------------

export class MargemLateral {
  readonly value: number;

  constructor(value: number) {
    if (value < 10 || value > 40) {
      throw new DomainException(
        'MARGEM_LATERAL_INVALIDA',
        422,
        `margem_lateral must be between 10 and 40 mm (received ${value})`,
      );
    }
    this.value = value;
  }
}

// ---------------------------------------------------------------------------
// HeadingSize — heading font size 14..48 px
// ---------------------------------------------------------------------------

export class HeadingSize {
  readonly value: number;
  readonly field: string;

  constructor(field: string, value: number) {
    if (value < 14 || value > 48) {
      throw new DomainException(
        `${field.toUpperCase()}_INVALIDO`,
        422,
        `${field} must be between 14 and 48 px (received ${value})`,
      );
    }
    this.value = value;
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// HeadingOrder — validates h1_tamanho >= h2_tamanho >= h3_tamanho
// ---------------------------------------------------------------------------

export function validateHeadingOrder(h1: number, h2: number, h3: number): void {
  if (h1 < h2 || h2 < h3) {
    throw new DomainException(
      'HEADING_ORDER_INVALIDA',
      422,
      `Heading sizes must satisfy h1_tamanho >= h2_tamanho >= h3_tamanho (h1=${h1}, h2=${h2}, h3=${h3})`,
    );
  }
}
