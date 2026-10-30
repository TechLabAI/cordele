/**
 * auth.guard.ts — re-exports authGuard from @cordele/shared/access-decision.
 * INT-FE-COMP-001 (P4): wired to AccessDecisionService.hasSession() (JWT present + not expired).
 *
 * COMP does not implement its own session logic — all auth is delegated to the shared layer.
 */
export { authGuard } from '@cordele/shared/access-decision';
