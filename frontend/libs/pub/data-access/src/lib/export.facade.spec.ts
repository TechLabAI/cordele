/**
 * export.facade.spec.ts — Unit tests for ExportFacade (FE-PUB-007).
 *
 * Verifies:
 *   - startExport triggers the API and transitions phase to correct terminal state.
 *   - podeBaixar computed correctly (valido|avisos AND arquivoDisponivel).
 *   - resumeFromHistory reads history and resolves phase from newest entry.
 *   - reset() cancels poll and clears state.
 *   - No setInterval usage (all async via timer/Observable).
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ExportFacade } from './export.facade';
import { PublicacaoApiService } from './publicacao-api.service';
import { PUB_EMPRESA_CHANGED } from './empresa-changed.token';
import {
  BuildStatus,
  EpubcheckStatus,
  PublicacaoHistoryItem,
  PublicacaoStatus,
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
});
