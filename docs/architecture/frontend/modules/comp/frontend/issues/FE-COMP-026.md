## [FE-COMP-026] Playwright e2e — configuracoes.feature (T05)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/comp-e2e/src/e2e/configuracoes.spec.ts` (gerado de `configuracoes.feature`) cobre os
10 grupos de cenários de T05 descritos em SPEC-08: guardas, hidratação com default lazy,
campos obrigatórios, re-fetch, avanço pessimista, upload/remoção de capa, erros 413/415,
gating de permissão/flag, erros de leitura e integração com shell.

**Context / Problem statement:**
- SPEC-08 §1 (configuracoes.feature) define os 10 grupos de cenários a cobrir.
- `fe-ears-coverage` gate valida que cada slug EARS de SPEC-01..07 tem cobertura Gherkin.
- O projeto Nx `comp-e2e` precisa estar registrado (FE-COMP-019 e guards em vigor).
- Executar: `npx nx e2e comp-e2e --grep "configuracoes"`.

**Approach (execution path):**
1. Implementar `apps/comp-e2e/src/e2e/configuracoes.spec.ts` a partir de `docs/architecture/frontend/modules/comp/frontend/e2e/configuracoes.feature`.
2. Cobrir todos os 10 grupos; usar Page Object (CompConfigPage) para seletores.
3. Mockar respostas HTTP (MSW ou Playwright route intercept) para simular `materialized:false`,
   `413`, `415`, `5xx`, `403`, `404`.
4. Verificar slugs EARS: `comp-guard-session`, `comp-guard-empresa`, `comp-guard-permission`,
   `comp-guard-projeto`, `comp-guard-status`, `comp-meta-refetch`, `comp-meta-hydrate`,
   `comp-meta-defaults`, `comp-meta-required`, `comp-advance-persist`, `comp-advance-persist-fail`,
   `comp-cover-upload`, `comp-cover-remove`, `comp-err-cover-size`, `comp-err-cover-format`,
   `comp-perm-edit`, `comp-flag-coverupload`, `comp-perm-accessdecision`, `comp-err-forbidden`,
   `comp-err-not-found`, `comp-err-read-5xx`, `comp-err-correlation`, `comp-shell-descriptor`,
   `comp-shell-navconfig`, `comp-shell-no-prefetch`, `comp-shell-destroy`.

**Non-goals:**
- Não cobre T06 (FE-COMP-027).
- Não testa a implementação interna das facades (responsabilidade de unit tests).

**Layer(s):**
frontend / apps/comp-e2e

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§1 configuracoes.feature)
- `docs/architecture/frontend/modules/comp/frontend/e2e/configuracoes.feature`

**Architecture alignment:**
- Runner: Playwright (`@nx/playwright`)
- Page Objects em `apps/comp-e2e/src/support/`
- Mocking via Playwright route intercept (sem dependência de servidor real)

**Implementation checklist (by file):**

**App: apps/comp-e2e**
- 🔲 `apps/comp-e2e/src/e2e/configuracoes.spec.ts`
- 🔲 `apps/comp-e2e/src/support/comp-config.page.ts` (Page Object)
- 🔲 `apps/comp-e2e/project.json` (Nx project registrado)

**Tests**
- 🔲 `nx e2e comp-e2e --grep configuracoes` PASS
- 🔲 `nx lint comp-e2e` PASS

**Milestone:**
Wave 9 / P9 e2e + Hardening

**Labels:**
type:e2e
layer:frontend
scope:comp
priority:P9

**Acceptance criteria:**
- `npx nx e2e comp-e2e --grep configuracoes` PASS
- Todos os slugs EARS de T05 cobertos
- `fe-ears-coverage` gate: exit 0

**Dependencies:**
- FE-COMP-011, FE-COMP-012, FE-COMP-013 (features T05 prontas), FE-COMP-019, FE-COMP-020 (guards)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Mocks via route intercept; nenhum servidor real necessário

**Testing / Evidence required:**
- `nx e2e comp-e2e --headed` para validação visual

**Risks / Notes:**
- Verificar que `apps/comp-e2e` está registrado no `workspace.json`/`project.json` Nx; se não, registrar via `fe-nx-register-module.py` ou manualmente (padrão D-487).
