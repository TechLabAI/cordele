# INT-COMP-005 -- CompositionErasurePort real adapter — PROJ LGPD leaf-first cascade (step 2)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Wires PROJ's injection of `COMPOSITION_ERASURE_PORT` from `CompModule` so that the LGPD
leaf-first erasure cascade (PROJ SPEC-11 / D-G) can call COMP's
`CompositionErasurePort.purge(projetoId)` as step 2 of the cascade:
PUB → **COMP** → IMP → `projeto_editorial`. Replaces any PROJ-side stub of
`CompositionErasurePort` with the real in-process call to COMP-017's implementation.
The purge is idempotent — PROJ may retry the cascade on partial failure and COMP's purge
completes without error even if rows/binary are already absent.

## Spec de referencia
- `contracts/integration-contracts.md` §1.4 (CompositionErasurePort — purge idempotent)
- SPEC-10 (integrations — §1.4; LGPD cascade step 2)
- PROJ SPEC-11 (erasure orchestration — leaf-first, COMP is step 2)

## Escopo

Files to create / amend (relative to monolith root `backend/`):

- [ ] `src/modules/proj/proj.module.ts` (amend) — import `CompModule`; inject `COMPOSITION_ERASURE_PORT` token into PROJ's `DeleteProjetoUseCase`; replace PROJ-015 stub adapter with COMP's real implementation
- [ ] `test/comp-proj-erasure-integration.spec.ts` — integration test: seed project with composed metadata + cover; call PROJ `DeleteProjetoUseCase`; verify COMP rows deleted; verify `FileStoragePort.delete` called; re-call `DeleteProjetoUseCase` (retry) → COMP purge no-op, cascade completes without error

## Criterios de aceite

- [ ] `DeleteProjetoUseCase` calls `CompositionErasurePort.purge` in the correct cascade order (step 2: after PUB, before IMP)
- [ ] Second call to `purge` for already-deleted project → no error, cascade continues
- [ ] Cover binary `FileStoragePort.delete` is called during purge (verified in integration test mock/spy)
- [ ] `pnpm test` on erasure integration spec exits 0

## Dependencias

- COMP-017 (precede — `CompositionErasurePort` implementation exported)
- PROJ-015 (precede — PROJ stub erasure port must exist to be replaced)

## Estimativa
M

## Prioridade
P6
