import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard, IS_PUBLIC_KEY, type AuthenticatedUser } from './jwt-auth.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-001',
    username: 'alice',
    roles: [],
    scopes: ['comp:read'],
    empresaId: 'aetos',
    ...overrides,
  };
}

function buildContext(
  user: AuthenticatedUser | undefined,
  headers: Record<string, string | string[] | undefined> = {},
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, headers }),
    }),
  } as unknown as ExecutionContext;
}

// Spy on the parent AuthGuard's canActivate to control Passport strategy outcome.
// JwtAuthGuard is 2 hops up the prototype chain:
//   guard.__proto__ = JwtAuthGuard.prototype
//   guard.__proto__.__proto__ = AuthGuard('jwt').prototype  ← target
function spyParentCanActivate(guard: JwtAuthGuard, returnValue: boolean | Error) {
  const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
    canActivate: (ctx: ExecutionContext) => Promise<boolean>;
  };
  if (returnValue instanceof Error) {
    return jest.spyOn(parentProto, 'canActivate').mockRejectedValueOnce(returnValue);
  }
  return jest
    .spyOn(parentProto, 'canActivate')
    .mockResolvedValueOnce(returnValue as boolean);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<
      Pick<Reflector, 'getAllAndOverride'>
    >;
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // @Public() — skip authentication entirely
  // -------------------------------------------------------------------------

  describe('@Public() routes', () => {
    it('should return true without invoking Passport', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
        key === IS_PUBLIC_KEY ? true : undefined,
      );

      const ctx = buildContext(undefined);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Missing / invalid token → 401
  // -------------------------------------------------------------------------

  describe('missing or invalid token', () => {
    it('should return false when Passport rejects (missing token → 401)', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      spyParentCanActivate(guard, false);

      const ctx = buildContext(undefined);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(false);
    });

    it('should propagate UnauthorizedException when Passport throws (expired token → 401)', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      const error = new Error('TokenExpiredError');
      spyParentCanActivate(guard, error);

      const ctx = buildContext(undefined);
      await expect(guard.canActivate(ctx)).rejects.toThrow('TokenExpiredError');
    });
  });

  // -------------------------------------------------------------------------
  // Valid token — empresa claim must be populated
  // -------------------------------------------------------------------------

  describe('valid token', () => {
    it('should return true and keep empresa claim from JWT', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      spyParentCanActivate(guard, true);

      const user = buildUser({ empresaId: 'aetos' });
      const req = { user, headers: {} };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.user.empresaId).toBe('aetos');
    });

    it('should throw 403 when token carries no empresa claim', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      spyParentCanActivate(guard, true);

      const user = buildUser({ empresaId: '' });
      const ctx = buildContext(user);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // X-Tenant-Id override (empresa-admin only)
  // -------------------------------------------------------------------------

  describe('X-Tenant-Id header', () => {
    it('should allow empresa-admin to override empresa via X-Tenant-Id', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      spyParentCanActivate(guard, true);

      const user = buildUser({ roles: ['empresa-admin'], empresaId: 'aetos' });
      const req = { user, headers: { 'x-tenant-id': 'outra-empresa' } };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.user.empresaId).toBe('outra-empresa');
    });

    it('should throw 403 when non-admin tries X-Tenant-Id override', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      spyParentCanActivate(guard, true);

      const user = buildUser({ roles: [], empresaId: 'aetos' });
      const ctx = buildContext(user, { 'x-tenant-id': 'outra-empresa' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
