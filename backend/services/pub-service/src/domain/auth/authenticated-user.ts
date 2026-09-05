/**
 * Request-scoped principal — pure TypeScript interface; zero Nest/Prisma imports.
 *
 * Produced by the JWT strategy (infrastructure/auth) and consumed by
 * controllers and use cases via modules/pub/decorators/current-user.decorator.ts.
 * Every repository call is scoped by empresaId (multi-empresa — schema-per-tenant).
 */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly roles: string[];
  readonly scopes: string[];
  /** Slug da empresa (ex.: "aetos" → schema "emp_aetos" via PrismaEmpresaService). */
  readonly empresaId: string;
}
