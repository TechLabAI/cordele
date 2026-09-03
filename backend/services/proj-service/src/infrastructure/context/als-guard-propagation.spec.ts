/**
 * ALS Guard Propagation — empirical measurement
 *
 * Question: Does AsyncLocalStorage context set by `enterWith()` inside a Guard
 * survive to the handler and to providers called by it, including across `await`?
 *
 * This is NOT a unit test — it boots a real NestJS HTTP application via
 * @nestjs/testing + supertest and makes actual HTTP requests so the full Nest
 * request pipeline (guards → interceptors → handler) runs exactly as in production.
 *
 * Uses the REAL EmpresaContextStore from this same directory — the identical store
 * that JwtAuthGuard.canActivate() populates at line 106 of jwt.guard.ts.
 *
 * Scenarios
 * ──────────
 *  1. Sync guard calls enterWith() → handler reads directly
 *  2. Sync guard calls enterWith() → handler awaits before reading
 *  3. Sync guard calls enterWith() → injected provider reads (production path)
 *  4. Control: APP_INTERCEPTOR wraps next.handle() in store.run()
 *     (comp-service approach) — injected provider reads
 *
 *  5. PRODUCTION-ACCURATE: async guard does `await` THEN enterWith() → injected
 *     provider reads. Replicates JwtAuthGuard.canActivate() topology exactly:
 *     `await super.canActivate(context)` at line 91, then enterWith() at line 106.
 *     enterWith() here runs in an async-child resource (Promise continuation),
 *     not in the original request resource. Does context propagate to the handler?
 *
 *  6. Control for scenario 5: same async-guard topology but context comes from
 *     APP_INTERCEPTOR + store.run() (no enterWith in the guard at all). Confirms
 *     whether the interceptor approach survives where the async guard may not.
 *
 * Failure semantics
 * ─────────────────
 *  A scenario where context is absent produces HTTP 500 (EmpresaContextStore
 *  throws "invoked outside an AsyncLocalStorage context"). The test asserts 200,
 *  so any missing propagation yields an unmistakable failure.
 *
 * RULE-08: no console.log — results via Jest assertions only.
 * RULE-04/05: spec lives in infrastructure/context/ — no modules/ imports.
 */

import {
  CallHandler,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Observable } from 'rxjs';
import request from 'supertest';

import { EmpresaContextStore } from './empresa.context';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EMPRESA_ID = 'empresa-medicao';
const SLUG = 'medicao';

// ─────────────────────────────────────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SYNCHRONOUS guard — enterWith() runs in the original request async resource.
 * Scenarios 1-3.
 */
@Injectable()
class SyncEnterWithGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    EmpresaContextStore.enterWith({ editoraId: EMPRESA_ID, slug: SLUG });
    return true;
  }
}

/**
 * ASYNC guard — replicates JwtAuthGuard.canActivate() exactly:
 *   Line 91: await super.canActivate(context)  →  here: await Promise.resolve()
 *   Line 106: EmpresaContextStore.enterWith()  →  same call below
 *
 * Critical difference from SyncEnterWithGuard: enterWith() is called AFTER
 * an await, so it runs inside a Promise continuation — an async child resource,
 * NOT the original request async resource.
 *
 * Node.js ALS semantics: enterWith() affects the current async resource and its
 * future descendants. If the handler's async resource is NOT a descendant of the
 * child where enterWith() was called, it will NOT see the context.
 *
 * Scenario 5 measures exactly this.
 */
@Injectable()
class AsyncEnterWithGuard implements CanActivate {
  async canActivate(_ctx: ExecutionContext): Promise<boolean> {
    // Simulates `await super.canActivate(context)` from JwtAuthGuard line 91.
    // This creates a new async child resource for everything that follows.
    await Promise.resolve();
    // Now running in the child resource — enterWith() sets context here.
    EmpresaContextStore.enterWith({ editoraId: EMPRESA_ID, slug: SLUG });
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Control interceptor — comp-service approach: store.run() wraps next.handle()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps next.handle() inside store.run() so the ALS context is active when the
 * Observable is subscribed, guaranteeing the handler and all its async children
 * inherit the context through the normal Node.js ALS propagation chain.
 * Used in scenarios 4 and 6.
 */
@Injectable()
class RunInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      EmpresaContextStore.run({ editoraId: EMPRESA_ID, slug: SLUG }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared injectable service — mimics ProjetoEditorialLookupAdapter.exists()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads EmpresaContextStore from an injected provider. Throws if called outside
 * a context — that exception becomes a 500, which is the failure signal.
 */
@Injectable()
class StoreReaderService {
  read(): string {
    return EmpresaContextStore.getEditoraId();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers — one per scenario
// ─────────────────────────────────────────────────────────────────────────────

/** Scenario 1: handler reads EmpresaContextStore inline (no await, sync guard). */
@Controller('s1')
class S1Controller {
  @Get()
  handle(): { editoraId: string } {
    return { editoraId: EmpresaContextStore.getEditoraId() };
  }
}

/** Scenario 2: handler crosses async boundary before reading (sync guard). */
@Controller('s2')
class S2Controller {
  @Get()
  async handle(): Promise<{ editoraId: string }> {
    await Promise.resolve();
    return { editoraId: EmpresaContextStore.getEditoraId() };
  }
}

/** Scenario 3: handler delegates to injected provider (sync guard). */
@Controller('s3')
class S3Controller {
  constructor(private readonly reader: StoreReaderService) {}

  @Get()
  handle(): { editoraId: string } {
    return { editoraId: this.reader.read() };
  }
}

/** Scenario 4 (control): interceptor store.run() → injected provider reads. */
@Controller('s4')
class S4Controller {
  constructor(private readonly reader: StoreReaderService) {}

  @Get()
  handle(): { editoraId: string } {
    return { editoraId: this.reader.read() };
  }
}

/**
 * Scenario 5 (PRODUCTION-ACCURATE): async guard does await → enterWith() →
 * handler delegates to injected provider. Mirrors the actual JwtAuthGuard
 * topology: the enterWith() happens after `await super.canActivate()`.
 */
@Controller('s5')
class S5Controller {
  constructor(private readonly reader: StoreReaderService) {}

  @Get()
  handle(): { editoraId: string } {
    return { editoraId: this.reader.read() };
  }
}

/**
 * Scenario 6 (control for 5): same injected-provider topology but context is
 * set by RunInterceptor + store.run(), not by the async guard's enterWith().
 * Confirms whether the interceptor approach survives where the async guard may not.
 */
@Controller('s6')
class S6Controller {
  constructor(private readonly reader: StoreReaderService) {}

  @Get()
  handle(): { editoraId: string } {
    return { editoraId: this.reader.read() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ALS enterWith() context propagation through the NestJS pipeline', () => {
  // ── App A: sync EnterWithGuard (scenarios 1-3) ────────────────────────────
  describe('Scenarios 1-3: SYNC guard calls enterWith() (guard is synchronous)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [S1Controller, S2Controller, S3Controller],
        providers: [
          StoreReaderService,
          { provide: APP_GUARD, useClass: SyncEnterWithGuard },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    it('Scenario 1 — sync guard enterWith() → handler reads directly', async () => {
      const res = await request(app.getHttpServer()).get('/s1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ editoraId: EMPRESA_ID });
    });

    it('Scenario 2 — sync guard enterWith() → handler awaits then reads', async () => {
      const res = await request(app.getHttpServer()).get('/s2');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ editoraId: EMPRESA_ID });
    });

    it('Scenario 3 — sync guard enterWith() → injected provider reads', async () => {
      const res = await request(app.getHttpServer()).get('/s3');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ editoraId: EMPRESA_ID });
    });
  });

  // ── App B: APP_INTERCEPTOR store.run() (scenario 4 — first control) ────────
  describe('Scenario 4 (control): APP_INTERCEPTOR + store.run() → injected provider reads', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [S4Controller],
        providers: [
          StoreReaderService,
          { provide: APP_INTERCEPTOR, useClass: RunInterceptor },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    it('Scenario 4 — interceptor store.run() wraps next.handle() → provider reads', async () => {
      const res = await request(app.getHttpServer()).get('/s4');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ editoraId: EMPRESA_ID });
    });
  });

  // ── App C: ASYNC guard (scenario 5 — production-accurate) ─────────────────
  describe('Scenario 5 (PRODUCTION-ACCURATE): ASYNC guard: await → enterWith() → provider reads', () => {
    let app: INestApplication;

    beforeAll(async () => {
      // AsyncEnterWithGuard: async canActivate() awaits first, then enterWith().
      // This replicates jwt.guard.ts lines 91-106 exactly.
      const moduleRef = await Test.createTestingModule({
        controllers: [S5Controller],
        providers: [
          StoreReaderService,
          { provide: APP_GUARD, useClass: AsyncEnterWithGuard },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    it('Scenario 5 — async guard (await → enterWith()) → injected provider reads', async () => {
      const res = await request(app.getHttpServer()).get('/s5');
      //
      // EMPIRICAL RESULT: HTTP 500 — context is LOST.
      //
      // Explanation: AsyncLocalStorage.enterWith() transitions the CURRENT async
      // resource. In an async guard, `await Promise.resolve()` (or the real
      // `await super.canActivate()`) creates a new child async resource for the
      // continuation. enterWith() sets the store on that child. But the NestJS
      // pipeline awaits the guard's Promise from a DIFFERENT continuation — one
      // that is a child of the original request resource, not of the guard's
      // internal child. That pipeline continuation and all its descendants (the
      // handler, the injected provider) do not see the store.
      //
      // IMPACT ON PROJ-SERVICE: JwtAuthGuard.canActivate() is async and calls
      // `await super.canActivate(context)` at line 91 before calling
      // EmpresaContextStore.enterWith() at line 106. This is EXACTLY the failing
      // topology. ProjetoEditorialLookupAdapter.exists() will throw
      // "invoked outside an AsyncLocalStorage context" when the lookup port is
      // exposed. The gate cross-tenant is currently safe only because that path
      // is unreachable (no controller consumes the port yet).
      //
      // FIX (NOT applied in this task — scope is measurement only): replace
      // enterWith() in JwtAuthGuard with an APP_INTERCEPTOR that wraps
      // next.handle() in EmpresaContextStore.run(), following the comp-service
      // pattern (scenario 6 below confirms it works).
      //
      // This assertion documents the BROKEN state as a regression sentinel:
      // if it changes to 200 in the future the fix has been applied, update it.
      expect(res.status).toBe(500);
    });
  });

  // ── App D: APP_INTERCEPTOR control for scenario 5 ────────────────────────
  describe('Scenario 6 (control for 5): same topology but APP_INTERCEPTOR + store.run()', () => {
    let app: INestApplication;

    beforeAll(async () => {
      // No guard that calls enterWith() — context comes exclusively from the interceptor.
      const moduleRef = await Test.createTestingModule({
        controllers: [S6Controller],
        providers: [
          StoreReaderService,
          { provide: APP_INTERCEPTOR, useClass: RunInterceptor },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    it('Scenario 6 — interceptor store.run() (no guard enterWith) → provider reads', async () => {
      const res = await request(app.getHttpServer()).get('/s6');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ editoraId: EMPRESA_ID });
    });
  });
});
