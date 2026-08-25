# PROJ-018 -- BDD Cucumber step definitions for 8 features and 44 scenarios in tests/cucumber/

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements the step definitions for all 8 Cucumber feature files already present in
`docs/architecture/backend/services/proj-service/tests/cucumber/` (44 scenarios generated in M2.5).
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

Files to create (relative to monolith root `backend/`):

- [ ] `test/proj/step-definitions/project-api-surface.steps.ts` — step defs for `project-api-surface-guard.feature`
- [ ] `test/proj/step-definitions/project-lifecycle.steps.ts` — step defs for `project-lifecycle-invariants.feature`; uses `ProjectStatus` VO directly for white-box assertions
- [ ] `test/proj/step-definitions/project-events.steps.ts` — step defs for `project-event-integrity.feature`; uses NestJS EventEmitter spy
- [ ] `test/proj/step-definitions/project-observability.steps.ts` — step defs for `project-observability-health.feature`; uses logger spy for `WARN degraded:true` assertions
- [ ] `test/proj/step-definitions/project-status-transitions.steps.ts` — step defs for `project-status-authority-transitions.feature`
- [ ] `test/proj/step-definitions/project-library.steps.ts` — step defs for `project-library-and-history-read.feature`; asserts port mock call count = 1 for batched reads (SPEC-10 cls 3)
- [ ] `test/proj/step-definitions/project-deletion.steps.ts` — step defs for LGPD erasure feature; verifies purge order via spy on port mocks
- [ ] `test/proj/cucumber.config.ts` — Cucumber runner configuration pointing to all 8 feature files and the step definition directory

## Criterios de aceite

- [ ] `pnpm test` Cucumber runner with all 8 feature files exits 0 (scenarios may be `pending` for unimplemented steps but must not error)
- [ ] Logger spy correctly captures `WARN degraded:true port=<PortName>` (SPEC-07 cls 3/5 scenarios pass)
- [ ] Port mock call count assertion enforced: `ManuscriptSummaryPort.summaries` called exactly once for a library of N projects (SPEC-10 cls 3)
- [ ] `ProjectStatusChanged` event spy asserted in event-integrity scenarios

## Dependencias

- PROJ-010 (precede — library use case under test)
- PROJ-011 (precede — detail use case under test)
- PROJ-016 (precede — deletion use case under test)
- PROJ-017 (precede — correlation ID + health under test)

## Estimativa
L

## Prioridade
P8
