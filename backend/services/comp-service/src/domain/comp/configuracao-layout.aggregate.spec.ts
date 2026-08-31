import { ConfiguracaoLayout } from './configuracao-layout.aggregate';
import { LayoutOverride } from './layout-override.entity';
import { DomainException } from '../shared/domain-exception';

/**
 * Unit spec for ConfiguracaoLayout aggregate — presentation rules (COMP-006).
 *
 * Covers:
 * - Lazy default factory `createDefault` (D-M).
 * - Typography bounds enforced when materialized=true (data-model §2.2).
 * - Heading order invariant (h1_tamanho >= h2_tamanho >= h3_tamanho).
 * - Override stale validation.
 * - LayoutOverride entity invariants (em-branco, alinhamento required for imagem).
 *
 * No Nest, no Prisma, no HTTP.
 */
describe('ConfiguracaoLayout', () => {
  const PROJETO_ID = '22222222-2222-4222-8222-222222222222';
  const EMPRESA_SLUG = 'aetos';

  const validProps = () => ({
    projetoId: PROJETO_ID,
    fonte_corpo_familia: 'serif' as const,
    fonte_corpo_tamanho: 12,
    espacamento_linha: 1.5,
    margem_lateral: 20,
    h1_tamanho: 28,
    h2_tamanho: 22,
    h3_tamanho: 18,
    overrides: [] as LayoutOverride[],
    empresaSlug: EMPRESA_SLUG,
    materialized: true,
  });

  // ---------------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------------

  it('rejects missing projetoId', () => {
    expect(() => new ConfiguracaoLayout({ ...validProps(), projetoId: '' }))
      .toThrow(/projetoId is required/);
  });

  it('rejects missing empresaSlug when explicitly provided as empty string', () => {
    expect(() => new ConfiguracaoLayout({ ...validProps(), empresaSlug: '' }))
      .toThrow(/empresaSlug is required/);
  });

  // ---------------------------------------------------------------------------
  // Lazy default (D-M) — COMP-006 acceptance criteria
  // ---------------------------------------------------------------------------

  it('createDefault() returns materialized=false with canonical defaults', () => {
    const aggregate = ConfiguracaoLayout.createDefault(PROJETO_ID);
    expect(aggregate.materialized).toBe(false);
    expect(aggregate.fonte_corpo_familia).toBe('serif');
    expect(aggregate.fonte_corpo_tamanho).toBe(12);
    expect(aggregate.espacamento_linha).toBe(1.5);
    expect(aggregate.margem_lateral).toBe(20);
    expect(aggregate.h1_tamanho).toBe(28);
    expect(aggregate.h2_tamanho).toBe(22);
    expect(aggregate.h3_tamanho).toBe(18);
    expect(aggregate.overrides).toHaveLength(0);
  });

  it('createDefault() with empresaSlug stores it correctly', () => {
    const aggregate = ConfiguracaoLayout.createDefault(PROJETO_ID, EMPRESA_SLUG);
    expect(aggregate.empresaSlug).toBe(EMPRESA_SLUG);
    expect(aggregate.materialized).toBe(false);
  });

  it('allows out-of-bounds values when materialized=false', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      fonte_corpo_tamanho: 99,
      materialized: false,
    })).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Typography invariants — enforced when materialized=true (COMP-006)
  // ---------------------------------------------------------------------------

  it('rejects fonte_corpo_tamanho < 12 (COMP-006 acceptance criteria)', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      fonte_corpo_tamanho: 11,
    })).toThrow(DomainException);
  });

  it('rejects fonte_corpo_tamanho > 20', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      fonte_corpo_tamanho: 21,
    })).toThrow(DomainException);
  });

  it('rejects espacamento_linha < 1.2', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      espacamento_linha: 1.1,
    })).toThrow(DomainException);
  });

  it('rejects margem_lateral < 10', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      margem_lateral: 9,
    })).toThrow(DomainException);
  });

  it('rejects margem_lateral > 40', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      margem_lateral: 41,
    })).toThrow(DomainException);
  });

  // ---------------------------------------------------------------------------
  // Heading order invariant: h1 >= h2 >= h3 (COMP-006 acceptance criteria)
  // ---------------------------------------------------------------------------

  it('rejects h1_tamanho < h2_tamanho (COMP-006 acceptance criteria)', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      h1_tamanho: 20,
      h2_tamanho: 22,
      h3_tamanho: 18,
    })).toThrow(DomainException);
  });

  it('rejects h2_tamanho < h3_tamanho', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      h1_tamanho: 28,
      h2_tamanho: 18,
      h3_tamanho: 22,
    })).toThrow(DomainException);
  });

  it('accepts equal heading sizes (h1==h2==h3 is valid)', () => {
    expect(() => new ConfiguracaoLayout({
      ...validProps(),
      h1_tamanho: 18,
      h2_tamanho: 18,
      h3_tamanho: 18,
    })).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------

  it('update() produces a materialized aggregate with new fields', () => {
    const base = ConfiguracaoLayout.createDefault(PROJETO_ID, EMPRESA_SLUG);
    const updated = base.update({ fonte_corpo_familia: 'sans-serif', fonte_corpo_tamanho: 14, espacamento_linha: 1.6 });
    expect(updated.materialized).toBe(true);
    expect(updated.fonte_corpo_familia).toBe('sans-serif');
    expect(updated.fonte_corpo_tamanho).toBe(14);
  });

  it('update() does not mutate the original', () => {
    const base = ConfiguracaoLayout.createDefault(PROJETO_ID, EMPRESA_SLUG);
    base.update({ margem_lateral: 30 });
    expect(base.margem_lateral).toBe(20);
  });

  it('update() with overrides list replaces existing overrides', () => {
    const base = ConfiguracaoLayout.createDefault(PROJETO_ID, EMPRESA_SLUG);
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 });
    const updated = base.update({}, [override]);
    expect(updated.overrides).toHaveLength(1);
    expect(updated.overrides[0].referenciaNo).toBe('img-001');
  });

  // ---------------------------------------------------------------------------
  // withValidatedOverrides / activeOverrides / staleOverrides
  // ---------------------------------------------------------------------------

  it('withValidatedOverrides() marks overrides whose referenciaNo is absent as stale', () => {
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 });
    const base = new ConfiguracaoLayout({ ...validProps(), overrides: [override] });
    const validated = base.withValidatedOverrides(new Set(['img-002'])); // img-001 absent
    expect(validated.overrides[0].stale).toBe(true);
    expect(validated.staleOverrides()).toHaveLength(1);
    expect(validated.activeOverrides()).toHaveLength(0);
  });

  it('withValidatedOverrides() keeps overrides whose referenciaNo is present as active', () => {
    const override = new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'centralizado', ordem: 0 });
    const base = new ConfiguracaoLayout({ ...validProps(), overrides: [override] });
    const validated = base.withValidatedOverrides(new Set(['img-001']));
    expect(validated.overrides[0].stale).toBe(false);
    expect(validated.activeOverrides()).toHaveLength(1);
    expect(validated.staleOverrides()).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // LayoutOverride entity invariants (COMP-006 acceptance criteria)
  // ---------------------------------------------------------------------------

  it('should reject tipo=em-branco with DomainException 422', () => {
    let caught: DomainException | undefined;
    try {
      new LayoutOverride({ referenciaNo: 'para-001', tipo: 'em-branco', ordem: 0 });
    } catch (e) {
      caught = e as DomainException;
    }
    expect(caught).toBeInstanceOf(DomainException);
    expect(caught?.status).toBe(422);
    expect(caught?.code).toBe('EM_BRANCO_NAO_SUPORTADO');
  });

  it('should reject tipo=imagem without alinhamento with DomainException 422 (COMP-006 acceptance criteria)', () => {
    let caught: DomainException | undefined;
    try {
      new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: undefined, ordem: 0 });
    } catch (e) {
      caught = e as DomainException;
    }
    expect(caught).toBeInstanceOf(DomainException);
    expect(caught?.status).toBe(422);
    expect(caught?.code).toBe('ALINHAMENTO_OBRIGATORIO_PARA_IMAGEM');
  });

  it('accepts LayoutOverride tipo=imagem with valid alinhamento', () => {
    expect(() =>
      new LayoutOverride({ referenciaNo: 'img-001', tipo: 'imagem', alinhamento: 'full', ordem: 0 }),
    ).not.toThrow();
  });
});
