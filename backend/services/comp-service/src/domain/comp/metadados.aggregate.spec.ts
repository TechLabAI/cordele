import { Metadados, IDIOMAS_VALIDOS } from './metadados.aggregate';
import { DomainException } from '../shared/domain-exception';

/**
 * Unit spec for the Metadados aggregate — COMP editorial identity.
 *
 * Covers all invariants enforced by the domain (titulo, autor, idioma), the
 * lazy-default factories (D-M), cover management and the update method.
 * No Nest, no Prisma, no HTTP.
 *
 * Tests 1-14 are a direct port of the original MetadadosEntity spec preserved
 * across the refactoring. Test 15 verifies the COMP-003 `createDefault` factory.
 */
describe('Metadados', () => {
  const PROJETO_ID = '11111111-1111-4111-8111-111111111111';
  const EMPRESA_SLUG = 'aetos';

  // ---------------------------------------------------------------------------
  // Constructor — structural guards
  // ---------------------------------------------------------------------------

  it('rejects missing projetoId', () => {
    expect(() => new Metadados({ projetoId: '', titulo: 'T', autor: 'A', idioma: 'pt', empresaSlug: EMPRESA_SLUG, materialized: false }))
      .toThrow(/projetoId is required/);
  });

  it('rejects missing empresaSlug', () => {
    expect(() => new Metadados({ projetoId: PROJETO_ID, titulo: 'T', autor: 'A', idioma: 'pt', empresaSlug: '', materialized: false }))
      .toThrow(/empresaSlug is required/);
  });

  // ---------------------------------------------------------------------------
  // Lazy default (D-M) — materialized=false bypasses invariants
  // ---------------------------------------------------------------------------

  it('defaultsFor() returns materialized=false with empty fields', () => {
    const entity = Metadados.defaultsFor(PROJETO_ID, EMPRESA_SLUG);
    expect(entity.materialized).toBe(false);
    expect(entity.projetoId).toBe(PROJETO_ID);
    expect(entity.empresaSlug).toBe(EMPRESA_SLUG);
    expect(entity.idioma).toBe('pt');
  });

  it('allows empty titulo when materialized=false', () => {
    const entity = new Metadados({
      projetoId: PROJETO_ID, titulo: '', autor: '', idioma: 'pt', empresaSlug: EMPRESA_SLUG, materialized: false,
    });
    expect(entity.titulo).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Invariants — enforced when materialized=true
  // ---------------------------------------------------------------------------

  it('rejects blank titulo when materialized=true', () => {
    expect(() => new Metadados({
      projetoId: PROJETO_ID, titulo: '  ', autor: 'Autor', idioma: 'pt', empresaSlug: EMPRESA_SLUG, materialized: true,
    })).toThrow(DomainException);
  });

  it('rejects blank autor when materialized=true', () => {
    expect(() => new Metadados({
      projetoId: PROJETO_ID, titulo: 'Titulo', autor: '', idioma: 'pt', empresaSlug: EMPRESA_SLUG, materialized: true,
    })).toThrow(DomainException);
  });

  it('rejects invalid idioma when materialized=true', () => {
    expect(() => new Metadados({
      projetoId: PROJETO_ID, titulo: 'Titulo', autor: 'Autor', idioma: 'de' as 'pt', empresaSlug: EMPRESA_SLUG, materialized: true,
    })).toThrow(DomainException);
  });

  it('accepts all valid idioma values', () => {
    for (const idioma of IDIOMAS_VALIDOS) {
      expect(() => new Metadados({
        projetoId: PROJETO_ID, titulo: 'T', autor: 'A', idioma, empresaSlug: EMPRESA_SLUG, materialized: true,
      })).not.toThrow();
    }
  });

  // ---------------------------------------------------------------------------
  // update() — produces a materialized aggregate
  // ---------------------------------------------------------------------------

  it('update() returns materialized=true entity with new fields', () => {
    const base = Metadados.defaultsFor(PROJETO_ID, EMPRESA_SLUG);
    const updated = base.update({ titulo: 'Novo Livro', autor: 'Novo Autor', idioma: 'en' });
    expect(updated.materialized).toBe(true);
    expect(updated.titulo).toBe('Novo Livro');
    expect(updated.autor).toBe('Novo Autor');
    expect(updated.idioma).toBe('en');
    expect(updated.projetoId).toBe(PROJETO_ID);
  });

  it('update() does not mutate the original', () => {
    const base = Metadados.defaultsFor(PROJETO_ID, EMPRESA_SLUG);
    base.update({ titulo: 'Outro', autor: 'A', idioma: 'pt' });
    expect(base.titulo).toBe('');
  });

  it('update() rejects blank titulo (invariant enforced)', () => {
    const base = Metadados.defaultsFor(PROJETO_ID, EMPRESA_SLUG);
    expect(() => base.update({ titulo: '', autor: 'A', idioma: 'pt' })).toThrow(DomainException);
  });

  // ---------------------------------------------------------------------------
  // withCapaUrl / withoutCapa
  // ---------------------------------------------------------------------------

  it('withCapaUrl() sets the capaUrl without changing materialized', () => {
    const base = Metadados.defaultsFor(PROJETO_ID, EMPRESA_SLUG);
    const withCover = base.withCapaUrl('https://storage/capa.jpg');
    expect(withCover.capaUrl).toBe('https://storage/capa.jpg');
    expect(withCover.materialized).toBe(false); // unchanged
    expect(withCover.projetoId).toBe(PROJETO_ID);
  });

  it('withoutCapa() clears capaUrl', () => {
    const base = new Metadados({
      projetoId: PROJETO_ID, titulo: 'T', autor: 'A', idioma: 'pt',
      capaUrl: 'https://storage/capa.jpg', empresaSlug: EMPRESA_SLUG, materialized: true,
    });
    const cleared = base.withoutCapa();
    expect(cleared.capaUrl).toBeNull();
    expect(cleared.titulo).toBe('T');
  });

  it('isbn and categoria default to null', () => {
    const entity = new Metadados({
      projetoId: PROJETO_ID, titulo: 'T', autor: 'A', idioma: 'pt', empresaSlug: EMPRESA_SLUG, materialized: true,
    });
    expect(entity.isbn).toBeNull();
    expect(entity.categoria).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // createDefault (COMP-003) — convenience factory without empresaSlug
  // ---------------------------------------------------------------------------

  it('createDefault returns materialized=false', () => {
    const entity = Metadados.createDefault(PROJETO_ID);
    expect(entity.materialized).toBe(false);
    expect(entity.projetoId).toBe(PROJETO_ID);
  });
});
