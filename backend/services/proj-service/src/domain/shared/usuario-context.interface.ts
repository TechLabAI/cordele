/**
 * Domain-level representation of the authenticated caller.
 *
 * Pure TypeScript interface — zero @nestjs/* and zero @prisma/client imports
 * (RULE-01 / RULE-02). Infrastructure resolves the concrete value from the JWT;
 * the domain receives only this minimal contract so application services stay
 * portable and testable without the Nest framework.
 *
 * Wired via the JWT guard (P5). In P1 stubs the controller does not yet inject
 * this; it will be propagated when @UseGuards and @CurrentUser are added.
 */
export interface UsuarioContext {
  /** Unique identifier of the authenticated user. */
  readonly id: string;
  /** Resolved empresa for this request — every repository call is scoped by it. */
  readonly empresaId: string;
  /** OAuth2 scopes granted to this principal (e.g. proj:read, proj:write). */
  readonly scopes: string[];
}
