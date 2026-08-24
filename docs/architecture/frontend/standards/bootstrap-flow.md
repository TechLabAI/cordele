# Bootstrap Flow (Cordelê Web)

> Startup sequence of `apps/cordele-web` + empresa switching.

Goal: provide a predictable startup sequence for `cordele-web` (Angular standalone).

---

## Bootstrap stages (in order)

1. **Start app route** -- Angular bootstrap, `provideRouter`, `provideHttpClient`.
2. **Restore session** (`AuthSessionService.restore()`)
   - reads the JWT from an httpOnly cookie (preferred) or from secure storage
   - validates the `exp` claim; if expired, redirect to the `iam-service` login
   - if valid: decodes the claims (`sub`, `roles`, `empresas`)
3. **Resolve the active empresa** (`EmpresaContextService.resolve()`)
   - if the JWT carries `empresa_id` (selected earlier): use it
   - if not, but the user has exactly 1 empresa: use it automatically
   - if the user has N > 1: redirect to the empresa selection screen
4. **Evaluate access decisions** (`AccessDecisionService.evaluate()`)
   - computes RBAC + feature flags + capabilities
5. **Build navigation** (`NavigationService.buildTree()`)
   - derives menu/breadcrumb from the decisions and from the registered `<modulo>.permission-map.ts`
6. **Render the Shell** (topbar/sidebar/content slots) and release the module routes
7. **Record telemetry** (`@cordele/shared/observability`)
   - bootstrap success/failure events
   - timing of each stage (for cold-start debugging)

---

## Switching the active empresa

When the user switches the active empresa through the selector (`EmpresaContextService.switchTo(empresaId)`):

- **Cancel in-flight requests** scoped to the previous empresa (the interceptor checks the header and discards them)
- **Invalidate scoped caches** explicitly (`QueryClient.invalidateQueries(['empresa', oldId])` or equivalent)
- **Recompute access decisions** (roles may vary per empresa)
- **Rebuild navigation** if the new empresa changes the enabled modules
- **Update the UI without a full refresh** (signals react)

---

## Global UX states

- **Loading:** while bootstrap has not completed
- **Error:** bootstrap failure (route to `ErrorPageComponent`)
- **No access:** the decision denies the route, or the active empresa does not enable the module
- **No empresa:** valid user with no empresa assigned (edge case -- show a clear message asking the user to contact an admin)

---

## Evidence / observability (minimum)

- Record bootstrap timing (start/end per stage).
- Record reason codes for failures (`auth_expired`, `empresa_resolve_failed`, `permission_denied`, ...).
- Record context switch events (`empresa_switched` old/new).
- Log through `@cordele/shared/observability` (never `console.log`).

---

## Anti-patterns (avoid)

- Synchronous bootstrap that blocks the UI for more than 1s with no visual feedback.
- RBAC decisions taken inside components during bootstrap (delegate to `AccessDecisionService`).
- Switching empresa without invalidating caches (empresa A data leaks into empresa B).
- Reloading the whole page (`location.reload()`) when switching empresa -- use signals instead.
