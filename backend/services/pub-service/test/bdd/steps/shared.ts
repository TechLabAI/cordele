/**
 * Steps shared by two or more PUB features (P8 / PUB-019).
 *
 * Each function is called from the step body of the matching scenario step.
 * They operate on the current BddTestContext exposed by `getCurrentContext()`.
 */
import { getCurrentContext } from './test-context';

/**
 * Sets up the empresa context for the active scenario (empresa = emp_aetos).
 *
 * Calls `empresaContextService.runAs('emp_aetos', () => {})` to initialise the
 * AsyncLocalStorage, establishing the tenant before any use-case is invoked.
 * The BddTestContext.fakeUser already carries `empresaId: 'emp_aetos'`.
 */
export function anAuthenticatedEditorOfEmpresaAetosWithScopePubW(): void {
  const ctx = getCurrentContext();
  // Initialise ALS so downstream runAs calls inherit the correct empresa.
  ctx.empresaContextService.runAs('emp_aetos', () => {
    /* intentionally empty — only initialises the ALS slot */
  });
}

/** Asserts that the last use-case invocation responded with HTTP 200. */
export function theResponseStatusIs200(): void {
  const ctx = getCurrentContext();
  expect(ctx.lastStatus).toBe(200);
}

/** Asserts that the last use-case invocation responded with HTTP 409. */
export function theResponseStatusIs409(): void {
  const ctx = getCurrentContext();
  expect(ctx.lastStatus).toBe(409);
}
