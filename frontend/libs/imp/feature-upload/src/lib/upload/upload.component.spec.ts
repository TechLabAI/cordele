/**
 * upload.component.spec.ts — Unit tests for UploadComponent (FE-IMP-016).
 *
 * Strategy: spy on ImportFacade via TestBed.overrideProvider — no HTTP involved.
 * Criterios de aceite (plan §3 P4):
 *   - submit válido → ImportFacade.importar() chamado
 *   - estado erro → UploadProgressCard mostra retry → reset()
 *   - reset() limpa seleção de arquivo
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { UploadComponent } from './upload.component';
import { ImportFacade, UploadPhase } from '@cordele/imp/data-access';

// ── Minimal facade stub ──────────────────────────────────────────────────────

function buildFacadeStub(overrides: Partial<{
  phase: UploadPhase;
  error: string | null;
}> = {}) {
  const _phase = signal<UploadPhase>(overrides.phase ?? 'idle');
  const _error = signal<string | null>(overrides.error ?? null);
  return {
    phase: _phase.asReadonly(),
    error: _error.asReadonly(),
    result: signal(null).asReadonly(),
    importar: vi.fn(),
    reset: vi.fn(),
    // Expose internal signals so tests can set phase/error
    _phase,
    _error,
  };
}

const MOCK_FILE = new File(['content'], 'manuscrito.docx', {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function setup(routeParams: Record<string, string> = {}) {
  const facadeStub = buildFacadeStub();

  TestBed.configureTestingModule({
    imports: [UploadComponent],
    providers: [
      { provide: ImportFacade, useValue: facadeStub },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => routeParams[key] ?? null,
            },
          },
        },
      },
    ],
  });

  const fixture: ComponentFixture<UploadComponent> = TestBed.createComponent(UploadComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, facadeStub };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UploadComponent', () => {

  describe('initial state', () => {
    it('should create', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('should call facade.reset() on init', () => {
      const { facadeStub } = setup();
      expect(facadeStub.reset).toHaveBeenCalled();
    });

    it('canSubmit should be false initially (no file selected)', () => {
      const { component } = setup();
      expect(component.canSubmit()).toBe(false);
    });

    it('should read projetoId from route params', () => {
      const { component } = setup({ projetoId: 'proj-abc-123' });
      expect(component.projetoId()).toBe('proj-abc-123');
    });
  });

  describe('importar() — submit', () => {
    it('should NOT call facade.importar() when canSubmit is false', () => {
      const { component, facadeStub } = setup();
      component.importar();
      expect(facadeStub.importar).not.toHaveBeenCalled();
    });

    it('should call facade.importar() with projetoTitulo when form is valid (new-project flow)', () => {
      const { component, facadeStub } = setup();

      // Simulate file selection via the handler
      component.onFileSelected(MOCK_FILE);
      component.nome.set('Meu Projeto de Teste');

      expect(component.canSubmit()).toBe(true);

      component.importar();

      expect(facadeStub.importar).toHaveBeenCalledWith({
        file: MOCK_FILE,
        projetoTitulo: 'Meu Projeto de Teste',
      });
    });

    it('should call facade.importar() with projetoId when in existing-project flow', () => {
      const { component, facadeStub } = setup({ projetoId: 'proj-existing-001' });

      component.onFileSelected(MOCK_FILE);

      expect(component.canSubmit()).toBe(true);

      component.importar();

      expect(facadeStub.importar).toHaveBeenCalledWith({
        file: MOCK_FILE,
        projetoId: 'proj-existing-001',
      });
    });

    it('should NOT call facade.importar() when nome is shorter than 3 chars (new-project flow)', () => {
      const { component, facadeStub } = setup();

      component.onFileSelected(MOCK_FILE);
      component.nome.set('AB'); // too short

      expect(component.canSubmit()).toBe(false);
      component.importar();

      expect(facadeStub.importar).not.toHaveBeenCalled();
    });
  });

  describe('onRetry() — error state recovery', () => {
    it('should call facade.reset() and clear selectedFileName on retry', () => {
      const { component, facadeStub } = setup();

      // Simulate a file having been selected
      component.onFileSelected(MOCK_FILE);
      expect(component.selectedFileName()).toBe('manuscrito.docx');

      // User clicks retry
      component.onRetry();

      expect(facadeStub.reset).toHaveBeenCalled();
      expect(component.selectedFileName()).toBe('');
    });

    it('canSubmit should be false after retry (file cleared)', () => {
      const { component } = setup();

      component.onFileSelected(MOCK_FILE);
      component.nome.set('Projeto Teste');
      expect(component.canSubmit()).toBe(true);

      component.onRetry();
      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('onValidationError()', () => {
    it('should clear selectedFile so canSubmit becomes false', () => {
      const { component } = setup();

      // First select a valid file
      component.onFileSelected(MOCK_FILE);
      component.nome.set('Projeto Válido');
      expect(component.canSubmit()).toBe(true);

      // Then receive a validation error (e.g. next file was invalid)
      component.onValidationError('Formato não suportado: .pdf. Use .docx ou .md.');
      expect(component.canSubmit()).toBe(false);
      expect(component.selectedFileName()).toBe('');
    });
  });

  describe('nome signal', () => {
    it('canSubmit should react to nome changes', () => {
      const { component } = setup();

      component.onFileSelected(MOCK_FILE);
      component.nome.set('AB'); // < 3
      expect(component.canSubmit()).toBe(false);

      component.nome.set('Meu Projeto'); // >= 3
      expect(component.canSubmit()).toBe(true);
    });
  });
});
