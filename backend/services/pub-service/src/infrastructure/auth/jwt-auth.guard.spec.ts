import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  IS_PUBLIC_KEY,
  JwtAuthGuard,
  REQUIRED_SCOPES_KEY,
  type AuthenticatedUser,
} from './jwt-auth.guard';

/**
 * Unit tests for `JwtAuthGuard` (PUB-013).
 *
 * The guard extends `AuthGuard('jwt')` (Passport) and adds:
 *   - `@Public()` short-circuit (returns true without JWT validation).
 *   - OAuth2 scope enforcement via `@RequiredScopes(...)`.
 *   - Tenant resolution: accepts `X-Tenant-Id` header override only for
 *     principals with the `empresa-admin` role; rejects cross-empresa
 *     attempts for ordinary users.
 *   - Throws ForbiddenException when the token carries no `empresaId` claim.
 *
 * `AuthGuard('jwt').canActivate` is mocked via `jest.spyOn(Object.getPrototypeOf(guard), 'canActivate')`
 * so the guard's own logic is exercised without a live Passport strategy.
 *
 * Behaviours verified:
 *   - `@Public()` handler bypasses JWT validation entirely.
 *   - Valid JWT (super returns true) → returns true when scopes match.
 *   - Valid JWT but missing required scope → ForbiddenException (403).
 *   - Valid JWT, non-admin requesting a different empresa → ForbiddenException.
 *   - Valid JWT, empresa-admin requesting a different empresa → empresaId switched.
 *   - Valid JWT with no empresaId claim → ForbiddenException.
 *   - Invalid JWT (super throws UnauthorizedException) → propagates.
 */
describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  /** Builds a minimal authenticated principal. */
  const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    userId: 'user-1',
    username: 'editor',
    roles: [],
    scopes: ['pub:read'],
    empresaId: 'empresa-aetos',
    ...overrides,
  });

  /**
   * Builds a fake `ExecutionContext` wired with the given request and
   * optionally with `Reflector.getAllAndOverride` returning the given values.
   */
  const makeContext = (
    request: Record<string, unknown>,
    reflectorValues: { isPublic?: boolean; requiredScopes?: string[] } = {},
  ): ExecutionContext => {
    const handler = jest.fn();
    const classRef = jest.fn();

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === IS_PUBLIC_KEY) return reflectorValues.isPublic ?? false;
      if (key === REQUIRED_SCOPES_KEY) return reflectorValues.requiredScopes ?? undefined;
      return undefined;
    });

    return {
      getHandler: () => handler,
      getClass: () => classRef,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // @Public() short-circuit
  // -------------------------------------------------------------------------

  describe('@Public() routes', () => {
    it('returns true without calling super.canActivate when @Public() is set', async () => {
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext({}, { isPublic: true });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(superSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // JWT validation
  // -------------------------------------------------------------------------

  describe('JWT validation', () => {
    it('returns true for a valid JWT with matching scopes', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ scopes: ['pub:read'] }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request, { requiredScopes: ['pub:read'] });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('propagates UnauthorizedException when super.canActivate throws (invalid token)', async () => {
      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockRejectedValue(new UnauthorizedException());

      const ctx = makeContext({}, { isPublic: false });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // Scope enforcement
  // -------------------------------------------------------------------------

  describe('scope enforcement', () => {
    it('throws ForbiddenException when the principal lacks the required scope', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ scopes: ['pub:read'] }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request, { requiredScopes: ['pub:write'] });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('returns true when no @RequiredScopes() decorator is present', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ scopes: [] }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request, { requiredScopes: undefined });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('returns true when the principal holds at least one of the required scopes', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ scopes: ['pub:read', 'pub:write'] }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request, { requiredScopes: ['pub:write'] });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Tenant resolution
  // -------------------------------------------------------------------------

  describe('tenant resolution', () => {
    it('throws ForbiddenException when a non-admin requests a different empresa via X-Tenant-Id', async () => {
      const request: Record<string, unknown> = {
        headers: { 'x-tenant-id': 'empresa-outro' },
        user: makeUser({ roles: [], empresaId: 'empresa-aetos' }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('allows an empresa-admin to switch to a different empresa via X-Tenant-Id', async () => {
      const request: Record<string, unknown> = {
        headers: { 'x-tenant-id': 'empresa-outro' },
        user: makeUser({ roles: ['empresa-admin'], empresaId: 'empresa-aetos' }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      // The user on the request should be updated to the switched empresa.
      expect((request.user as AuthenticatedUser).empresaId).toBe('empresa-outro');
    });

    it('throws ForbiddenException when the token carries no empresaId claim', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ empresaId: '' }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('keeps the original empresaId when no X-Tenant-Id header is present', async () => {
      const request: Record<string, unknown> = {
        headers: {},
        user: makeUser({ empresaId: 'empresa-aetos' }),
      };

      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(true);

      const ctx = makeContext(request);

      await guard.canActivate(ctx);

      expect((request.user as AuthenticatedUser).empresaId).toBe('empresa-aetos');
    });
  });
});
