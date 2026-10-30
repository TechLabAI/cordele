/**
 * imp-shell-integration.service.spec.ts — unit tests (INT-FE-IMP-005, INT-FE-IMP-006, FE-IMP-023).
 *
 * Tests:
 *   1. init() registers IMP permissions with AccessDecisionService.
 *   2. init() registers IMP feature flags with AccessDecisionService.
 *   3. empresaChanged signal starts at 0 (no change on boot).
 *   4. empresaChanged signal increments when the active empresa changes.
 *   5. empresaChanged signal increments again on subsequent changes.
 *   6. emitLifecycleEvent() calls console.info with event name and data (FE-IMP-023).
 *   7. emitLifecycleEvent() without data omits payload gracefully.
 *
 * Uses signal-based effect() tracking — no zone.js / fakeAsync required.
 * TestBed.flushEffects() drives synchronous effect execution.
 */
import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { ImpShellIntegrationService } from './imp-shell-integration.service';
import { EmpresaContextService } from '@cordele/shared/empresa-context';
import { AccessDecisionService } from '@cordele/shared/access-decision';

// ── Mocks ─────────────────────────────────────────────────────────────────────

function createEmpresaMock(): { current: WritableSignal<string | null> } {
  return { current: signal<string | null>('emp_aetos') };
}

function createAccessMock() {
  return {
    registerPermissions: vi.fn(),
    registerFlags: vi.fn(),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ImpShellIntegrationService', () => {
  let svc: ImpShellIntegrationService;
  let empresaMock: ReturnType<typeof createEmpresaMock>;
  let accessMock: ReturnType<typeof createAccessMock>;

  beforeEach(() => {
    empresaMock = createEmpresaMock();
    accessMock  = createAccessMock();

    TestBed.configureTestingModule({
      providers: [
        ImpShellIntegrationService,
        { provide: EmpresaContextService,  useValue: empresaMock },
        { provide: AccessDecisionService,  useValue: accessMock  },
      ],
    });

    // Inject service — constructor runs the boot effect synchronously
    svc = TestBed.inject(ImpShellIntegrationService);
    // Flush the boot effect so _bootstrapped = true before assertions
    TestBed.flushEffects();
  });

  // ── init() ─────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('registers all three IMP permission mappings', () => {
      svc.init();

      expect(accessMock.registerPermissions).toHaveBeenCalledTimes(1);
      expect(accessMock.registerPermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          'imp.import':  { beScope: 'imp:write' },
          'imp.review':  { beScope: 'imp:read'  },
          'imp.confirm': { beScope: 'imp:write' },
        }),
      );
    });

    it('registers all three IMP feature flags', () => {
      svc.init();

      expect(accessMock.registerFlags).toHaveBeenCalledTimes(1);
      expect(accessMock.registerFlags).toHaveBeenCalledWith(
        expect.objectContaining({
          'imp.reimport':        { defaultState: 'on' },
          'imp.ignoreFragment':  { defaultState: 'on' },
          'imp.existingProject': { defaultState: 'on' },
        }),
      );
    });
  });

  // ── empresaChanged ─────────────────────────────────────────────────────────

  describe('empresaChanged signal', () => {
    it('starts at 0 — no change on construction (boot effect is skipped)', () => {
      expect(svc.empresaChanged()).toBe(0);
    });

    it('increments to 1 on first empresa switch after boot', () => {
      empresaMock.current.set('emp_beta');
      TestBed.flushEffects(); // drives the reactive effect synchronously
      expect(svc.empresaChanged()).toBe(1);
    });

    it('increments again on each subsequent empresa switch', () => {
      empresaMock.current.set('emp_beta');
      TestBed.flushEffects();
      empresaMock.current.set('emp_gamma');
      TestBed.flushEffects();
      expect(svc.empresaChanged()).toBe(2);
    });
  });

  // ── emitLifecycleEvent (FE-IMP-023) ────────────────────────────────────────

  describe('emitLifecycleEvent()', () => {
    it('calls console.info with the event name and data payload', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      svc.emitLifecycleEvent('imp.import.started', { manuscritoId: 'ms-001' });

      expect(spy).toHaveBeenCalledWith(
        '[IMP telemetry]',
        'imp.import.started',
        { manuscritoId: 'ms-001' },
      );

      spy.mockRestore();
    });

    it('calls console.info with an empty object when no data is supplied', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      svc.emitLifecycleEvent('imp.import.succeeded');

      expect(spy).toHaveBeenCalledWith('[IMP telemetry]', 'imp.import.succeeded', {});

      spy.mockRestore();
    });

    it('does not throw when called multiple times (import:started, import:succeeded)', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      expect(() => {
        svc.emitLifecycleEvent('imp.import.started');
        svc.emitLifecycleEvent('imp.import.succeeded', { manuscritoId: 'ms-002' });
        svc.emitLifecycleEvent('imp.structure.confirmed', { manuscritoId: 'ms-002' });
      }).not.toThrow();

      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });
});
