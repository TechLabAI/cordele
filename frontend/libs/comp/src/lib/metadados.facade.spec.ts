/**
 * metadados.facade.spec.ts — unit tests for MetadadosFacade state machine.
 * FE-COMP-008: canAdvance, state transitions, cover sub-state, pessimistic advance.
 *
 * Pattern: each describe block that needs a different port configuration calls
 * TestBed.configureTestingModule in its own beforeEach so the module is
 * not yet instantiated when providers are set.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MetadadosFacade } from './metadados.facade';
import { METADADOS_PORT } from './api/metadados.port';
import type { MetadadosPort } from './api/metadados.port';
import type { MetadadosDto, CapaUploadResponse } from './models/comp.models';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOADED_DTO: MetadadosDto = {
  projetoId: 'proj-001',
  titulo: 'O Livro',
  autor: 'A Autora',
  isbn: null,
  idioma: 'pt',
  categoria: null,
  capaUrl: null,
  materialized: true,
};

const DEFAULT_DTO: MetadadosDto = {
  projetoId: 'proj-999',
  titulo: '',
  autor: '',
  isbn: null,
  idioma: 'pt',
  categoria: null,
  capaUrl: null,
  materialized: false,
};

function makeRouter(): { navigate: ReturnType<typeof vi.fn> } {
  return { navigate: vi.fn().mockResolvedValue(true) };
}

function makePort(overrides: Partial<MetadadosPort> = {}): MetadadosPort {
  return {
    get:        vi.fn().mockReturnValue(of(LOADED_DTO)),
    update:     vi.fn().mockReturnValue(of(LOADED_DTO)),
    uploadCapa: vi.fn().mockReturnValue(of({ capaUrl: 'https://cdn.example.com/capa.jpg' } satisfies CapaUploadResponse)),
    removeCapa: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}

function setup(port: MetadadosPort, router: ReturnType<typeof makeRouter>): MetadadosFacade {
  TestBed.configureTestingModule({
    providers: [
      MetadadosFacade,
      { provide: METADADOS_PORT, useValue: port },
      { provide: Router, useValue: router },
    ],
  });
  return TestBed.inject(MetadadosFacade);
}

// ── Base behaviour ────────────────────────────────────────────────────────────

describe('MetadadosFacade — initial state', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
  });

  it('starts in idle status', () => {
    expect(facade.status()).toBe('idle');
  });

  it('starts with canAdvance=false (empty form)', () => {
    expect(facade.canAdvance()).toBe(false);
  });
});

// ── canAdvance ────────────────────────────────────────────────────────────────

describe('MetadadosFacade — canAdvance', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('is false when titulo is empty', () => {
    facade.onFieldChange('titulo', '');
    expect(facade.canAdvance()).toBe(false);
  });

  it('is false when autor is empty', () => {
    facade.onFieldChange('autor', '');
    expect(facade.canAdvance()).toBe(false);
  });

  it('is false when idioma is not in valid set', () => {
    facade.onFieldChange('idioma', 'de' as 'pt');
    expect(facade.canAdvance()).toBe(false);
  });

  it('is true with valid titulo, autor=A Autora, and idioma=pt (LOADED_DTO defaults)', () => {
    expect(facade.canAdvance()).toBe(true);
  });

  it('is true for all valid idiomas: pt en es fr', () => {
    for (const idioma of ['pt', 'en', 'es', 'fr'] as const) {
      facade.onFieldChange('idioma', idioma);
      expect(facade.canAdvance()).toBe(true);
    }
  });
});

// ── load state machine ────────────────────────────────────────────────────────

describe('MetadadosFacade — load: 200 success', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
  });

  it('transitions idle → loading → ready on 200', () => {
    facade.load('proj-001');
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
  });

  it('hydrates form from server dto when materialized:true', () => {
    facade.load('proj-001');
    TestBed.flushEffects();
    expect(facade.form().titulo).toBe('O Livro');
  });
});

describe('MetadadosFacade — load: materialized:false resets form to defaults', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    const port = makePort({ get: vi.fn().mockReturnValue(of(DEFAULT_DTO)) });
    facade = setup(port, makeRouter());
  });

  it('form has empty titulo and idioma=pt after loading materialized:false', () => {
    facade.load('proj-999');
    TestBed.flushEffects();
    expect(facade.form().titulo).toBe('');
    expect(facade.form().idioma).toBe('pt');
  });
});

describe('MetadadosFacade — load: 5xx error', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    const port = makePort({
      get: vi.fn().mockReturnValue(throwError(() => ({ status: 500, error: {}, message: 'Server error' }))),
    });
    facade = setup(port, makeRouter());
  });

  it('sets status=error with error-state channel', () => {
    facade.load('proj-001');
    TestBed.flushEffects();
    expect(facade.status()).toBe('error');
    expect(facade.error()?.channel).toBe('error-state');
  });
});

// ── onFieldChange ─────────────────────────────────────────────────────────────

describe('MetadadosFacade — onFieldChange', () => {
  let facade: MetadadosFacade;
  let port: MetadadosPort;

  beforeEach(() => {
    port = makePort();
    facade = setup(port, makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('updates the form signal locally without HTTP call', () => {
    facade.onFieldChange('titulo', 'Novo Título');
    expect(facade.form().titulo).toBe('Novo Título');
    expect(vi.mocked(port.update)).not.toHaveBeenCalled();
  });
});

// ── onAdvanceToLayout — success ───────────────────────────────────────────────

describe('MetadadosFacade — onAdvanceToLayout: 200 success', () => {
  let facade: MetadadosFacade;
  let port: MetadadosPort;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    port = makePort();
    router = makeRouter();
    facade = setup(port, router);
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('calls port.update and navigates to T06 on 200', () => {
    facade.onAdvanceToLayout();
    TestBed.flushEffects();
    expect(vi.mocked(port.update)).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith([
      '/comp', 'projetos', 'proj-001', 'editor-de-layout-preview',
    ]);
  });

  it('sets status=ready after successful advance', () => {
    facade.onAdvanceToLayout();
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
  });

  it('does nothing when canAdvance=false', () => {
    facade.onFieldChange('titulo', '');
    facade.onAdvanceToLayout();
    TestBed.flushEffects();
    expect(vi.mocked(port.update)).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

// ── onAdvanceToLayout — 5xx failure ──────────────────────────────────────────

describe('MetadadosFacade — onAdvanceToLayout: 5xx failure', () => {
  let facade: MetadadosFacade;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    const port = makePort({
      update: vi.fn().mockReturnValue(throwError(() => ({ status: 500, error: {}, message: 'Error' }))),
    });
    router = makeRouter();
    facade = setup(port, router);
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('status=ready, NO navigation, local edits preserved', () => {
    facade.onFieldChange('titulo', 'Edição local');
    facade.onAdvanceToLayout();
    TestBed.flushEffects();

    expect(facade.status()).toBe('ready');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(facade.form().titulo).toBe('Edição local');
    expect(facade.toast()).toBeTruthy();
  });
});

// ── cover: upload success ─────────────────────────────────────────────────────

describe('MetadadosFacade — onCoverSelect: 200 success', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('cover.status=idle after success; capaUrl set; form.capaUrl updated', () => {
    const file = new File(['img'], 'capa.jpg', { type: 'image/jpeg' });
    facade.onCoverSelect(file);
    TestBed.flushEffects();

    expect(facade.cover().status).toBe('idle');
    expect(facade.cover().capaUrl).toBe('https://cdn.example.com/capa.jpg');
    expect(facade.form().capaUrl).toBe('https://cdn.example.com/capa.jpg');
  });
});

// ── cover: 413 ───────────────────────────────────────────────────────────────

describe('MetadadosFacade — onCoverSelect: 413 cover-too-large', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    const port = makePort({
      uploadCapa: vi.fn().mockReturnValue(throwError(() => ({
        status: 413,
        error: { type: 'urn:cordele:comp:cover-too-large', detail: 'Too large' },
        message: 'Payload too large',
      }))),
    });
    facade = setup(port, makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('cover.status=error with cover-inline channel; form intact', () => {
    const file = new File(['img'], 'huge.jpg', { type: 'image/jpeg' });
    facade.onCoverSelect(file);
    TestBed.flushEffects();

    expect(facade.cover().status).toBe('error');
    expect(facade.cover().error?.channel).toBe('cover-inline');
    expect(facade.cover().error?.message).toContain('10 MB');
    expect(facade.form().titulo).toBe('O Livro');  // form intact
  });
});

// ── cover: 415 ───────────────────────────────────────────────────────────────

describe('MetadadosFacade — onCoverSelect: 415 unsupported-format', () => {
  let facade: MetadadosFacade;

  beforeEach(() => {
    const port = makePort({
      uploadCapa: vi.fn().mockReturnValue(throwError(() => ({
        status: 415,
        error: { type: 'urn:cordele:comp:unsupported-cover-format' },
        message: 'Unsupported media',
      }))),
    });
    facade = setup(port, makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('cover.error.message contains format names', () => {
    facade.onCoverSelect(new File(['img'], 'bad.bmp', { type: 'image/bmp' }));
    TestBed.flushEffects();
    expect(facade.cover().error?.message).toContain('JPEG');
  });
});

// ── cover remove ─────────────────────────────────────────────────────────────

describe('MetadadosFacade — onCoverRemove', () => {
  let facade: MetadadosFacade;
  let port: MetadadosPort;

  beforeEach(() => {
    port = makePort();
    facade = setup(port, makeRouter());
    facade.load('proj-001');
    TestBed.flushEffects();
  });

  it('DELETE capa called; cover cleared; form.capaUrl=null', () => {
    facade.onCoverRemove();
    TestBed.flushEffects();

    expect(vi.mocked(port.removeCapa)).toHaveBeenCalledWith('proj-001');
    expect(facade.cover().capaUrl).toBeNull();
    expect(facade.form().capaUrl).toBeNull();
  });
});
