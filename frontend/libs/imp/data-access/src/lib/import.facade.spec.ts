import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImportFacade } from './import.facade';
import { ManuscritoHttpAdapter } from './adapters/manuscrito-http.adapter';
import { MANUSCRITO_PORT } from './ports/manuscrito.port';
import { ManuscritoDetail } from './models/imp.models';
import { ImpShellIntegrationService } from '@cordele/imp/integration';

const MOCK_MANUSCRITO: ManuscritoDetail = {
  id: 'ms-test-001',
  projetoId: 'proj-test-001',
  nomeArquivo: 'test.docx',
  formato: 'docx',
  status: 'imported',
  totalCapitulos: 3,
  totalImagens: 0,
  trechosNaoParseados: 1,
  tamanhoBytes: 1024,
  estrutura: {
    schemaVersion: '1.0',
    formato: 'docx',
    chapters: [],
  },
  criadoEm: '2026-08-31T10:00:00Z',
};

describe('ImportFacade', () => {
  let facade: ImportFacade;
  let httpMock: HttpTestingController;
  let router: Router;
  let navigateSpy: any;

  beforeEach(() => {
    // FE-IMP-023: include emitLifecycleEvent in the mock (P6 addition)
    const mockIntegrationSvc = {
      empresaChanged: signal(0),
      emitLifecycleEvent: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        ImportFacade,
        ManuscritoHttpAdapter,
        { provide: MANUSCRITO_PORT, useClass: ManuscritoHttpAdapter },
        { provide: ImpShellIntegrationService, useValue: mockIntegrationSvc },
      ],
    });

    facade = TestBed.inject(ImportFacade);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    // Mock router.navigate to prevent "Cannot match any routes" errors in tests
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should start in idle phase', () => {
      expect(facade.phase()).toBe('idle');
    });

    it('should have no error initially', () => {
      expect(facade.error()).toBeNull();
    });

    it('should have no result initially', () => {
      expect(facade.result()).toBeNull();
    });
  });

  describe('importar()', () => {
    it('should transition idle → uploading immediately on call', () => {
      const file = new File(['docx content'], 'romance.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      facade.importar({ file, projetoTitulo: 'Meu Projeto' });

      expect(facade.phase()).toBe('uploading');
      expect(facade.error()).toBeNull();

      // Flush to avoid afterEach httpMock.verify() failure
      httpMock.expectOne('/api/v1/imp/manuscripts').flush(MOCK_MANUSCRITO);
    });

    it('should transition to done and store result on HTTP 201 success', () => {
      const file = new File([''], 'book.docx');

      facade.importar({ file, projetoTitulo: 'Livro Teste' });

      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      expect(req.request.method).toBe('POST');
      req.flush(MOCK_MANUSCRITO, { status: 201, statusText: 'Created' });

      expect(facade.phase()).toBe('done');
      expect(facade.error()).toBeNull();
      expect(facade.result()).toEqual(MOCK_MANUSCRITO);
      expect(navigateSpy).toHaveBeenCalledWith(
        ['/imp/manuscritos', 'ms-test-001', 'revisao'],
        { state: { manuscrito: MOCK_MANUSCRITO } },
      );
    });

    it('should transition to error on HTTP 422 and expose error message', () => {
      const file = new File([''], 'book.docx');
      facade.importar({ file, projetoTitulo: 'Projeto' });

      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      req.flush(
        { detail: 'Informe o nome do projeto ou selecione um existente, mas não ambos.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      expect(facade.phase()).toBe('error');
      expect(facade.error()).toBeTruthy();
    });

    it('should transition to error on HTTP 413 (file too large)', () => {
      const file = new File([''], 'huge.docx');
      facade.importar({ file, projetoTitulo: 'Grande Projeto' });

      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      req.flush(null, { status: 413, statusText: 'Payload Too Large' });

      expect(facade.phase()).toBe('error');
    });

    it('should send multipart/form-data body (FormData) with projetoTitulo', () => {
      const file = new File([''], 'manuscript.docx');
      facade.importar({ file, projetoTitulo: 'Título do Projeto' });

      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      expect(req.request.body).toBeInstanceOf(FormData);
      req.flush(MOCK_MANUSCRITO);
    });

    it('should send projetoId in FormData when provided', () => {
      const file = new File([''], 'manuscript.docx');
      facade.importar({ file, projetoId: 'proj-existing-001' });

      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      expect(req.request.body).toBeInstanceOf(FormData);
      const form: FormData = req.request.body;
      expect(form.get('projetoId')).toBe('proj-existing-001');
      req.flush(MOCK_MANUSCRITO);
    });
  });

  describe('reset()', () => {
    it('should return to idle phase and clear error and result', () => {
      const file = new File([''], 'test.docx');
      facade.importar({ file, projetoTitulo: 'P' });

      // Flush the request to avoid verify() error
      const req = httpMock.expectOne('/api/v1/imp/manuscripts');
      req.flush(null, { status: 500, statusText: 'Internal Server Error' });

      expect(facade.phase()).toBe('error');

      facade.reset();

      expect(facade.phase()).toBe('idle');
      expect(facade.error()).toBeNull();
      expect(facade.result()).toBeNull();
    });

    it('should reset from done state back to idle', () => {
      const file = new File([''], 'book.docx');
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      facade.importar({ file, projetoTitulo: 'Projeto' });
      httpMock.expectOne('/api/v1/imp/manuscripts').flush(MOCK_MANUSCRITO);

      expect(facade.phase()).toBe('done');

      facade.reset();
      expect(facade.phase()).toBe('idle');
    });
  });
});
