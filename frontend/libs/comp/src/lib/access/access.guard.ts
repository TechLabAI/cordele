/**
 * access.guard.ts — re-exports accessGuard factory from @cordele/shared/access-decision.
 * INT-FE-COMP-005 (P4): wired to AccessDecisionService.can(permission).
 *
 * Usage: canActivate: [accessGuard('comp.view')]
 * Evaluates COMP_PERMISSION_MAP entries against JWT scopes.
 * SPEC-05 §2: every COMP permission check goes through AccessDecisionService.
 */
export { accessGuard } from '@cordele/shared/access-decision';
