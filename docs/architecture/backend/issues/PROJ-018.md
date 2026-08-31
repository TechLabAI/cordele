# PROJ-018 -- BDD step definitions for 8 features and 44 scenarios (jest-cucumber via jest-bdd.json)
<!-- status: in-review -->

**Status:** NEAR-CLOSED -- pos-validacao 2026-08-28
**Maturidade:** 90 -- Maduro
**Done/Total:** 12/12 itens

## Contexto

Implements the step definitions for all 8 feature files present in
`backend/services/proj-service/test/bdd/features/` (44 scenarios generated in M2.5).
Runner: jest-cucumber via `test/jest-bdd.json` (same pattern as imp-service — not standalone Cucumber CLI).
Features cover: API surface guard, lifecycle invariants, event integrity, observability/health,
status transitions, library/history read, cross-context deletion LGPD erasure.

Notable step-definition challenges flagged in M2.5 handoff:
- SPEC-07 logging scenarios require a **logger spy** on NestJS logger — step defs must intercept
  the logger, not assert DB state.
- SPEC-10 cls 3 (batch reads) step defs must count **port mock call count**, not DB queries.

## Spec de referencia
- SPEC-08 (bdd-test-scenarios)
- tests/cucumber/ (8 feature files, 44 scenarios)
- M2.5 handoff warnings (logger spy, port call count)

## Escopo

Files implemented (relative to `backend/services/proj-service/`):

- [x] `test/bdd/project-api-surface-guard.steps.ts` — step defs for `test/bdd/features/project-api-surface-guard.feature`
- [x] `test/bdd/project-lifecycle-invariants.steps.ts` — step defs for `test/bdd/features/project-lifecycle-invariants.feature`; uses `ProjectStatus` VO directly for white-box assertions
- [x] `test/bdd/project-event-integrity.steps.ts` — step defs for `test/bdd/features/project-event-integrity.feature`; uses NestJS EventEmitter spy
- [x] `test/bdd/project-observability-health.steps.ts` — step defs for `test/bdd/features/project-observability-health.feature`; uses logger spy for `WARN degraded:true` assertions
- [x] `test/bdd/project-status-authority-transitions.steps.ts` — step defs for `test/bdd/features/project-status-authority-transitions.feature`
- [x] `test/bdd/project-library-and-history-read.steps.ts` — step defs for `test/bdd/features/project-library-and-history-read.feature`; asserts port mock call count = 1 for batched reads (SPEC-10 cls 3)
- [x] `test/bdd/cross-context-deletion-lgpd-erasure.steps.ts` — step defs for `test/bdd/features/cross-context-deletion-lgpd-erasure.feature`; verifies purge order via spy on port mocks
- [x] `test/jest-bdd.json` — jest-cucumber runner config pointing to `bdd/` rootDir with `testRegex: \\.steps\\.ts$` (same pattern as imp-service)

## Criterios de aceite

- [x] `pnpm test --config test/jest-bdd.json` with all 8 feature files exits 0 (scenarios may be `pending` for unimplemented steps but must not error); runner is jest-cucumber, not standalone Cucumber CLI
- [x] Logger spy correctly captures `WARN degraded:true port=<PortName>` (SPEC-07 cls 3/5 scenarios implemented in project-observability-health.steps.ts)
- [x] Port mock call count assertion enforced: `ManuscriptSummaryPort.summaries` called exactly once for a library of N projects (SPEC-10 cls 3, implemented in project-library-and-history-read.steps.ts)
- [x] `ProjectStatusChanged` event spy asserted in event-integrity scenarios (implemented in project-event-integrity.steps.ts)

## Dependencias

- PROJ-010 (precede — library use case under test)
- PROJ-011 (precede — detail use case under test)
- PROJ-016 (precede — deletion use case under test)
- PROJ-017 (precede — correlation ID + health under test)

## Estimativa
L

## Prioridade
P8
