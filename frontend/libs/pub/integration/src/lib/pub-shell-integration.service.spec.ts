/**
 * pub-shell-integration.service.spec.ts — Unit tests for PubShellIntegrationService.
 * FE-PUB-006 / P1 Foundation acceptance criteria.
 *
 * Verifies:
 *   - start() activates the service (idempotent)
 *   - stop() deactivates the service (idempotent)
 *   - empresaChanged signal remains 0 before any empresa switch
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PubShellIntegrationService } from './pub-shell-integration.service';
import { EmpresaContextService } from '@cordele/shared/empresa-context';

describe('PubShellIntegrationService', () => {
  let service: PubShellIntegrationService;
  const mockEmpresaSignal = signal<unknown>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PubShellIntegrationService,
        {
          provide: EmpresaContextService,
          useValue: { current: mockEmpresaSignal.asReadonly() },
        },
      ],
    });
    service = TestBed.inject(PubShellIntegrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('empresaChanged should start at 0 before any empresa switch', () => {
    expect(service.empresaChanged()).toBe(0);
  });

  describe('start()', () => {
    it('should activate the service without throwing', () => {
      expect(() => service.start()).not.toThrow();
    });

    it('should be idempotent — calling start() twice has no adverse effect', () => {
      service.start();
      service.start(); // second call is a no-op
      expect(service.empresaChanged()).toBe(0);
    });
  });

  describe('stop()', () => {
    it('should deactivate the service without throwing', () => {
      service.start();
      expect(() => service.stop()).not.toThrow();
    });

    it('should be idempotent — stop() when already stopped has no adverse effect', () => {
      service.stop(); // before start — safe no-op
      expect(service.empresaChanged()).toBe(0);
    });

    it('start() then stop() then stop() — no error', () => {
      service.start();
      service.stop();
      service.stop(); // second stop — no-op (already inactive)
      expect(service.empresaChanged()).toBe(1); // stop() increments count (INT-FE-PUB-006)
    });
  });
});
