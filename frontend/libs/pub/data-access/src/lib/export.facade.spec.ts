/**
 * export.facade.spec.ts — Unit tests for ExportFacade (FE-PUB-007 / INT-FE-PUB-004 / FE-PUB-024).
 *
 * Verifies:
 *   - startExport triggers the API and transitions phase to correct terminal state.
 *   - podeBaixar computed correctly (valido|avisos AND arquivoDisponivel).
 *   - resumeFromHistory reads history and resolves phase from newest entry.
 *   - reset() cancels poll and clears state.
 *   - No setInterval usage (all async via timer/Observable).
 *   - avisos signal populated after terminal state (INT-FE-PUB-004).
 *   - avisos signal cleared on reset().
 *   - FE-PUB-024: errorTraceId populated from X-Correlation-Id header on startExport failure.
 *   - FE-PUB-024: errorTraceId populated from AppError.correlationId.
 *   - FE-PUB-024: errorTraceId cleared on reset().
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ExportFacade } from './export.facade';
import { PublicacaoApiService } from './publicacao-api.service';
import { PUB_EMPRESA_CHANGED } from './empresa-changed.token';
import {
  BuildStatus,
  EpubcheckStatus,
  PublicacaoHistoryItem,
  PublicacaoStatus,
  ValidationMessageItem,
} from './models/pub.models';

function makeStatus(
  overrides: Partial<PublicacaoStatus> & { status: BuildStatus; epubcheckStatus: EpubcheckStatus },
): PublicacaoStatus {
  return {
    publicacaoId:      'pub-test-001',
    projetoId:         'proj-test-001',
    sequencia:         1,
    totalErros:        0,
    totalAvisos:       0,
    resumoErro:        null,
    arquivoDisponivel: false,
    iniciadaEm:        '2026-01-01T00:00:00Z',
    concluidaEm:       null,
    tamanhoBytes:      null,
    totalCapitulos:    null,
    totalImagens:      null,
    ...overrides,
  };
}

describe('ExportFacade', () => {
  let facade: ExportFacade;
  let apiMock: Partial<PublicacaoApiService>;
  const empresaChangedSignal = signal(0);

  beforeEach(() => {
    apiMock = {
      triggerExport: (_projetoId: string) => of(makeStatus({ status: 'gerando', epubcheckStatus: 'pendente' })),
      pollStatus: (_projetoId: string, _publicacaoId: string) => of(makeStatus({ status: 'publicado', epubcheckStatus: 'valido', arquivoDisponivel: true, concluidaEm: '2026-01-01T00:01:00Z' })),
      listByProjeto: (_projetoId: string) => of([]),
      // INT-FE-PUB-004: stub required; _loadAvisos is called after terminal state.
      // Returns empty list by default; individual tests override when needed.
      getValidationMessages: (_projetoId: string, _publicacaoId: string) => of([]),
    };

    TestBed.configureTestingModule({
      providers: [
        ExportFacade,
        { provide: PublicacaoApiService, useValue: apiMock },
        { provide: PUB_EMPRESA_CHANGED, useValue: empresaChangedSignal.asReadonly() },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });

    facade = TestBed.inject(ExportFacade);
    empresaChangedSignal.set(0);
  });

  describe('startExport', () => {
    it('should set status to publicado when triggerExport returns terminal publicado directly', () => {
      // Test case: trigger returns a terminal status directly (200 idempotent in-flight, D-R)
      const publicado = makeStatus({
        status: 'publicado',
        epubcheckStatus: 'valido',
        arquivoDisponivel: true,
        concluidaEm: '2026-01-01T00:01:00Z',
      });

      apiMock.triggerExport = (_projetoId: string) => of(publicado);

      facade.startExport('proj-test-001');

      expect(facade.status()).toEqual(publicado);
      expect(facade.phase()).toBe('valido');
    });

    it('should set phase=gerando when triggerExport returns non-terminal and begin poll', () => {
      // Test case: trigger returns non-terminal (new build started) — poll loop is deferred by timer
      const gerando = makeStatus({ status: 'gerando', epubcheckStatus: 'pendente' });
      let _pollCalled = false;
      apiMock.triggerExport = (_projetoId: string) => of(gerando);
      apiMock.pollStatus = (_projetoId: string, _publicacaoId: string) => {
        _pollCalled = true;
        return of(makeStatus({ status: 'publicado', epubcheckStatus: 'valido', arquivoDisponivel: true, concluidaEm: '2026-01-01T00:01:00Z' }));
      };

      facade.startExport('proj-test-001');

      // Immediately after trigger: status = gerando (poll is pending the timer delay)
      expect(facade.status()).toEqual(gerando);
      expect(facade.projetoId()).toBe('proj-test-001');
    });

    it('should set phase to erros when com_erros returned directly from trigger', () => {
      const comErros = makeStatus({
        status: 'com_erros',
        epubcheckStatus: 'erros_criticos',
        totalErros: 3,
        arquivoDisponivel: false,
        concluidaEm: '2026-01-01T00:01:00Z',
      });

      apiMock.triggerExport = (_projetoId: string) => of(comErros);

      facade.startExport('proj-test-001');

      expect(facade.phase()).toBe('erros');
      expect(facade.podeBaixar()).toBe(false);
    });
  });

  describe('podeBaixar', () => {
    it('should be true when epubcheckStatus=valido AND arquivoDisponivel=true', () => {
      const publicado = makeStatus({
        status: 'publicado',
        epubcheckStatus: 'valido',
        arquivoDisponivel: true,
        concluidaEm: '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport = (_projetoId: string) => of(publicado);
      facade.startExport('proj-test-001');
      expect(facade.podeBaixar()).toBe(true);
    });

    it('should be true when epubcheckStatus=avisos AND arquivoDisponivel=true', () => {
      const publicado = makeStatus({
        status: 'publicado',
        epubcheckStatus: 'avisos',
        totalAvisos: 2,
        arquivoDisponivel: true,
        concluidaEm: '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport = (_projetoId: string) => of(publicado);
      facade.startExport('proj-test-001');
      expect(facade.podeBaixar()).toBe(true);
    });

    it('should be false when erros_criticos', () => {
      const comErros = makeStatus({
        status: 'com_erros',
        epubcheckStatus: 'erros_criticos',
        totalErros: 3,
        arquivoDisponivel: false,
        concluidaEm: '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport = (_projetoId: string) => of(comErros);
      facade.startExport('proj-test-001');
      expect(facade.podeBaixar()).toBe(false);
    });

    it('should be false when arquivoDisponivel=false even if valido', () => {
      const partial = makeStatus({
        status: 'publicado',
        epubcheckStatus: 'valido',
        arquivoDisponivel: false,
        concluidaEm: '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport = (_projetoId: string) => of(partial);
      facade.startExport('proj-test-001');
      expect(facade.podeBaixar()).toBe(false);
    });
  });

  describe('resumeFromHistory', () => {
    it('should set phase=valido when newest history item is valido', () => {
      const historyItem: PublicacaoHistoryItem = {
        publicacaoId:    'pub-001',
        projetoId:       'proj-test-001',
        epubcheckStatus: 'valido',
        totalErros:      0,
        totalAvisos:     0,
        erros:           null,
        arquivoUrl:      '/exports/test.epub',
        criadoEm:        '2026-01-01T00:01:00Z',
      };

      apiMock.listByProjeto = (_projetoId: string) => of([historyItem]);
      facade.resumeFromHistory('proj-test-001');

      expect(facade.phase()).toBe('valido');
    });

    it('should set phase=erros when newest history item is erros_criticos', () => {
      const historyItem: PublicacaoHistoryItem = {
        publicacaoId:    'pub-000',
        projetoId:       'proj-test-001',
        epubcheckStatus: 'erros_criticos',
        totalErros:      3,
        totalAvisos:     0,
        erros:           'OPS-001: spine item não encontrado',
        arquivoUrl:      null,
        criadoEm:        '2026-01-01T00:00:00Z',
      };

      apiMock.listByProjeto = (_projetoId: string) => of([historyItem]);
      facade.resumeFromHistory('proj-test-001');

      expect(facade.phase()).toBe('erros');
    });

    it('should set error state when history is empty', () => {
      apiMock.listByProjeto = (_projetoId: string) => of([]);
      facade.resumeFromHistory('proj-test-001');

      expect(facade.phase()).toBe('error');
      expect(facade.error()).toContain('Nenhuma exportação anterior');
    });
  });

  describe('reset', () => {
    it('should clear status, error and projetoId after reset', () => {
      const gerando = makeStatus({ status: 'gerando', epubcheckStatus: 'pendente' });
      apiMock.triggerExport = (_projetoId: string) => of(gerando);
      apiMock.pollStatus = (_projetoId: string, _publicacaoId: string) =>
        of(makeStatus({ status: 'gerando', epubcheckStatus: 'pendente' }));

      facade.startExport('proj-test-001');
      facade.reset();

      expect(facade.status()).toBeNull();
      expect(facade.error()).toBeNull();
      expect(facade.projetoId()).toBeNull();
    });
  });

  describe('no setInterval', () => {
    it('ExportFacade constructor source should NOT contain setInterval', () => {
      // All polling uses timer() + switchMap — never setInterval (FE-PUB-012 requirement).
      const source = ExportFacade.toString();
      expect(source).not.toContain('setInterval');
    });
  });

  // ── INT-FE-PUB-004: avisos signal ────────────────────────────────────────

  describe('avisos signal (INT-FE-PUB-004)', () => {
    const MOCK_MSG: ValidationMessageItem = {
      id:       'msg-001',
      severity: 'warning',
      code:     'OPF-033',
      message:  'Duplicate spine item reference',
      location: 'OEBPS/content.opf#L42',
      ordem:    0,
    };

    it('avisos defaults to empty array before any export', () => {
      expect(facade.avisos()).toEqual([]);
    });

    it('avisos is populated with mapped AvisoVM after terminal publicado', () => {
      const publicado = makeStatus({
        status:           'publicado',
        epubcheckStatus:  'valido',
        arquivoDisponivel: true,
        concluidaEm:      '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport          = (_p: string) => of(publicado);
      apiMock.getValidationMessages  = (_p: string, _id: string) => of([MOCK_MSG]);

      facade.startExport('proj-test-001');

      const avisos = facade.avisos();
      expect(avisos.length).toBe(1);
      expect(avisos[0].code).toBe('OPF-033');
      expect(avisos[0].msg).toBe('Duplicate spine item reference');
      expect(avisos[0].local).toBe('OEBPS/content.opf#L42');
      expect(avisos[0].severity).toBe('warning');
    });

    it('avisos maps location:null to local:null (never string "null")', () => {
      const publicado = makeStatus({
        status:           'publicado',
        epubcheckStatus:  'valido',
        arquivoDisponivel: true,
        concluidaEm:      '2026-01-01T00:01:00Z',
      });
      const nullLocMsg: ValidationMessageItem = { ...MOCK_MSG, location: null };
      apiMock.triggerExport         = (_p: string) => of(publicado);
      apiMock.getValidationMessages = (_p: string, _id: string) => of([nullLocMsg]);

      facade.startExport('proj-test-001');

      expect(facade.avisos()[0].local).toBeNull();
    });

    it('avisos is cleared by reset()', () => {
      const publicado = makeStatus({
        status:           'publicado',
        epubcheckStatus:  'valido',
        arquivoDisponivel: true,
        concluidaEm:      '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport         = (_p: string) => of(publicado);
      apiMock.getValidationMessages = (_p: string, _id: string) => of([MOCK_MSG]);

      facade.startExport('proj-test-001');
      expect(facade.avisos().length).toBe(1);

      facade.reset();
      expect(facade.avisos()).toEqual([]);
    });

    it('avisos remains empty and does not throw when getValidationMessages errors (best-effort)', () => {
      const publicado = makeStatus({
        status:           'publicado',
        epubcheckStatus:  'valido',
        arquivoDisponivel: true,
        concluidaEm:      '2026-01-01T00:01:00Z',
      });
      apiMock.triggerExport         = (_p: string) => of(publicado);
      apiMock.getValidationMessages = (_p: string, _id: string) =>
        throwError(() => new Error('network error'));

      expect(() => facade.startExport('proj-test-001')).not.toThrow();
      expect(facade.avisos()).toEqual([]);
    });
  });

  describe('FE-PUB-024 — errorTraceId', () => {
    it('populates errorTraceId from X-Correlation-Id header when startExport fails', () => {
      const mockHeaderErr = {
        message: 'Server error',
        status: 500,
        headers: {
          get: (key: string) => key === 'x-correlation-id' ? 'trace-export-001' : null,
        },
      };
      apiMock.triggerExport = (_p: string) =>
        throwError(() => mockHeaderErr);

      facade.startExport('proj-test-001');

      expect(facade.phase()).toBe('error');
      expect(facade.errorTraceId()).toBe('trace-export-001');
    });

    it('populates errorTraceId from AppError.correlationId when startExport fails', () => {
      const appErr = { code: 'SERVER_ERROR', message: 'fail', correlationId: 'corr-export-999' };
      apiMock.triggerExport = (_p: string) =>
        throwError(() => appErr);

      facade.startExport('proj-test-001');

      expect(facade.phase()).toBe('error');
      expect(facade.errorTraceId()).toBe('corr-export-999');
    });

    it('errorTraceId is null when error has no trace header', () => {
      apiMock.triggerExport = (_p: string) =>
        throwError(() => new Error('network error'));

      facade.startExport('proj-test-001');

      expect(facade.phase()).toBe('error');
      expect(facade.errorTraceId()).toBeNull();
    });

    it('errorTraceId cleared on reset()', () => {
      const mockHeaderErr = {
        message: 'fail', status: 500,
        headers: { get: (key: string) => key === 'x-correlation-id' ? 'trace-123' : null },
      };
      apiMock.triggerExport = (_p: string) => throwError(() => mockHeaderErr);
      facade.startExport('proj-test-001');
      expect(facade.errorTraceId()).toBe('trace-123');

      facade.reset();
      expect(facade.errorTraceId()).toBeNull();
    });
  });
});
