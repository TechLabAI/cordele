import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ScopeGuard, REQUIRED_SCOPES_KEY } from './scope.guard';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates a ScopeGuard whose Reflector returns `requiredScopes` for
 * REQUIRED_SCOPES_KEY and `undefined` for any other key.
 */
function makeGuard(requiredScopes: string[] | undefined): ScopeGuard {
  const reflector = {
    getAllAndOverride: jest
      .fn()
      .mockImplementation((key: string) =>
        key === REQUIRED_SCOPES_KEY ? requiredScopes : undefined,
      ),
  } as unknown as Reflector;
  return new ScopeGuard(reflector);
}

/**
 * Builds a minimal ExecutionContext with `request.user` as provided.
 * The Reflector is NOT used from the context — it is injected into the guard.
 */
function buildContext(user: { scopes: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScopeGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // No scope metadata — open route
  // -------------------------------------------------------------------------

  describe('when no @RequiredScopes metadata is present', () => {
    it('should return true (no-op) when metadata is undefined', () => {
      const guard = makeGuard(undefined);
      const ctx = buildContext({ scopes: [] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should return true for an empty scopes array', () => {
      const guard = makeGuard([]);
      const ctx = buildContext({ scopes: [] });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // comp:read scope enforcement (read routes)
  // -------------------------------------------------------------------------

  describe('comp:read route', () => {
    it('should pass when token has comp:read scope', () => {
      const guard = makeGuard(['comp:read']);
      const ctx = buildContext({ scopes: ['comp:read'] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should throw 403 when token has only comp:write on a comp:read route', () => {
      // Scopes are disjunctive — comp:write does NOT imply comp:read.
      const guard = makeGuard(['comp:read']);
      const ctx = buildContext({ scopes: ['comp:write'] });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should pass when token has both comp:read and comp:write on a read route', () => {
      const guard = makeGuard(['comp:read']);
      const ctx = buildContext({ scopes: ['comp:read', 'comp:write'] });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // comp:write scope enforcement (write routes)
  // -------------------------------------------------------------------------

  describe('comp:write route', () => {
    it('should pass when token has comp:write scope', () => {
      const guard = makeGuard(['comp:write']);
      const ctx = buildContext({ scopes: ['comp:write'] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should throw 403 when token has comp:read only on a write route (→ 403)', () => {
      const guard = makeGuard(['comp:write']);
      const ctx = buildContext({ scopes: ['comp:read'] });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should include the required scope name in the ForbiddenException message', () => {
      const guard = makeGuard(['comp:write']);
      const ctx = buildContext({ scopes: ['comp:read'] });
      expect(() => guard.canActivate(ctx)).toThrow(/comp:write/);
    });
  });

  // -------------------------------------------------------------------------
  // Missing principal — guard ordering violation
  // -------------------------------------------------------------------------

  describe('when request.user is missing (guard ordering misconfiguration)', () => {
    it('should throw UnauthorizedException', () => {
      const guard = makeGuard(['comp:read']);
      const ctx = buildContext(undefined);
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
