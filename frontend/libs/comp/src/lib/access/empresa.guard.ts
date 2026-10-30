/**
 * empresa.guard.ts — re-exports empresaGuard from @cordele/shared/empresa-context.
 * INT-FE-COMP-006 (P4): wired to EmpresaContextService.current() signal.
 *
 * Blocks COMP routes when no active empresa is set in the session.
 * Empresa is resolved server-side from the JWT claim empresa_id (multi-empresa.md §3).
 * Empresa is resolved server-side from the JWT `empresa_id` claim — the FE does not send X-Empresa-Id.
 */
export { empresaGuard } from '@cordele/shared/empresa-context';
