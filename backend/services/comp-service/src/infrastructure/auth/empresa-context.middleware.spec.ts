import { EmpresaContextMiddleware } from './empresa-context.middleware';
import { EmpresaContextService } from './empresa-context.service';

/**
 * Unit tests for EmpresaContextMiddleware (COMP-018 — correlationId ALS propagation).
 *
 * Key assertions:
 *  1. A correlationId present on `req` (set by CorrelationMiddleware) is forwarded
 *     into the AsyncLocalStorage context so providers can read it without explicit
 *     parameter passing.
 *  2. An incoming correlationId is reused, not substituted (because CorrelationMiddleware
 *     already echoes the client-supplied header; this middleware must not overwrite it).
 *  3. When no usable JWT is present, `next()` is called without an ALS context.
 *
 * Uses a real `EmpresaContextService` instance (backed by AsyncLocalStorage) to
 * verify that the ALS propagation actually works end-to-end, not just that the
 * correct arguments are passed.
 *
 * RULE-08: no console.log. ✓
 */

/** Build a minimal JWT with the given sub and empresa_id (not signed — middleware decodes only). */
function buildFakeJwt(sub: string, empresaId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub, empresa_id: empresaId })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

/** Build minimal req / res / next mocks. */
function buildMocks(options: {
  correlationId?: string;
  authorization?: string;
} = {}) {
  const req = {
    headers: {} as Record<string, string>,
    correlationId: options.correlationId,
  } as Parameters<InstanceType<typeof EmpresaContextMiddleware>['use']>[0];

  if (options.authorization) {
    req.headers['authorization'] = options.authorization;
  }

  const res = {} as Parameters<InstanceType<typeof EmpresaContextMiddleware>['use']>[1];
  const next = jest.fn();

  return { req, res, next };
}

describe('EmpresaContextMiddleware', () => {
  let service: EmpresaContextService;
  let middleware: EmpresaContextMiddleware;

  beforeEach(() => {
    service = new EmpresaContextService();
    middleware = new EmpresaContextMiddleware(service);
  });

  // -------------------------------------------------------------------------
  // correlationId ALS propagation (COMP-018)
  // -------------------------------------------------------------------------

  describe('correlationId propagation into ALS', () => {
    it('forwards req.correlationId into the ALS context when JWT is valid', (done) => {
      const correlationId = 'test-correlation-id-123';
      const jwt = buildFakeJwt('user-1', 'emp_aetos');

      const { req, res } = buildMocks({
        correlationId,
        authorization: `Bearer ${jwt}`,
      });

      // Replace next with a callback that reads from ALS while still inside the run() scope.
      const capturedNext = () => {
        const ctx = service.get();
        expect(ctx).toBeDefined();
        expect(ctx?.correlationId).toBe(correlationId);
        expect(ctx?.userId).toBe('user-1');
        expect(ctx?.empresaId).toBe('emp_aetos');
        done();
      };

      middleware.use(req, res, capturedNext);
    });

    it('reuses an incoming correlationId — does not regenerate it', (done) => {
      const incomingId = 'incoming-id-from-caller';
      const jwt = buildFakeJwt('user-2', 'emp_aetos');

      const { req, res } = buildMocks({
        correlationId: incomingId,
        authorization: `Bearer ${jwt}`,
      });

      const capturedNext = () => {
        const ctx = service.get();
        // Must be the exact same id that arrived on the request, not a new UUID.
        expect(ctx?.correlationId).toBe(incomingId);
        done();
      };

      middleware.use(req, res, capturedNext);
    });

    it('ALS context has correlationId=undefined when req.correlationId is absent', (done) => {
      const jwt = buildFakeJwt('user-3', 'emp_aetos');

      const { req, res } = buildMocks({
        // correlationId intentionally not set (CorrelationMiddleware not in chain)
        authorization: `Bearer ${jwt}`,
      });

      const capturedNext = () => {
        const ctx = service.get();
        expect(ctx).toBeDefined();
        expect(ctx?.correlationId).toBeUndefined();
        done();
      };

      middleware.use(req, res, capturedNext);
    });

    it('correlationId is available via EmpresaContextService.get() inside the ALS scope', (done) => {
      const correlationId = 'scope-test-id';
      const jwt = buildFakeJwt('user-4', 'emp_aetos');

      const { req, res } = buildMocks({
        correlationId,
        authorization: `Bearer ${jwt}`,
      });

      const capturedNext = () => {
        // Simulate what a repository or use-case would call to include correlationId in logs.
        const id = service.get()?.correlationId;
        expect(id).toBe(correlationId);
        done();
      };

      middleware.use(req, res, capturedNext);
    });
  });

  // -------------------------------------------------------------------------
  // Routes without a JWT — no ALS context
  // -------------------------------------------------------------------------

  describe('unauthenticated requests (no Bearer token)', () => {
    it('calls next() without establishing an ALS context', () => {
      const { req, res, next } = buildMocks({ correlationId: 'cid-health' });

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      // ALS must NOT be set — health / metrics routes are unauthenticated.
      expect(service.get()).toBeUndefined();
    });

    it('calls next() when authorization header is missing entirely', () => {
      const { req, res, next } = buildMocks();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(service.get()).toBeUndefined();
    });

    it('calls next() when token has fewer than 3 parts (malformed)', () => {
      const { req, res, next } = buildMocks({
        authorization: 'Bearer notavalidtoken',
      });

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // JWT payload edge cases
  // -------------------------------------------------------------------------

  describe('JWT payload edge cases', () => {
    it('calls next() without ALS when sub is missing from payload', () => {
      // Build a JWT with no sub field.
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ empresa_id: 'emp_aetos' })).toString('base64url');
      const token = `${header}.${payload}.sig`;

      const { req, res, next } = buildMocks({ authorization: `Bearer ${token}` });

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(service.get()).toBeUndefined();
    });

    it('calls next() without ALS when payload is not valid JSON', () => {
      // Second segment is not valid base64url JSON.
      const { req, res, next } = buildMocks({
        authorization: 'Bearer aaa.!!!.ccc',
      });

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
