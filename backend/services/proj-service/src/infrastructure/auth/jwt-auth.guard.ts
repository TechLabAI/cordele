/**
 * Canonical re-export shim.
 *
 * The actual `JwtAuthGuard` implementation lives in `jwt.guard.ts` — the path
 * cited by the PROJ-014 checklist as the canonical file that validates JWT
 * tokens, throws 401 on missing/invalid tokens, and populates `EmpresaContext`
 * (slug + editoraId) from the JWT claims.
 *
 * This module preserves backward-compatible import paths already used by
 * `app.module.ts`, `jwt-auth.guard.spec.ts`, and the e2e specs, so both
 * `infrastructure/auth/jwt-auth.guard` and `infrastructure/auth/jwt.guard`
 * resolve to the same exported symbols without duplication of logic.
 *
 * RULE-04: this file is in `infrastructure/auth/` — not imported by modules/.
 */
export * from './jwt.guard';
