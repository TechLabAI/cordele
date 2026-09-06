## [FE-PUB-027] Playwright e2e — T07 exportacao-e-validacao.feature (19 cenários SPEC-08)

**Status:** ✅ DONE
**GitHub:** [#TBD]

**Outcome:**
`apps/pub-e2e/src/exportacao-e-validacao.feature` promovido de
`docs/architecture/frontend/modules/pub/frontend/e2e/exportacao-e-validacao.feature`
e as step definitions correspondentes implementadas. Todos os 19 cenários do SPEC-08 cobertos
e passando via `npx nx e2e pub-e2e`.

**Context / Problem statement:**
- SPEC-08 §1: 19 cenários para T07 (trigger, poll, idempotente, indeterminado, veredito, avisos,
  resume, baixar→T08, otimismo, errors pre-flight, status-advance-failed, verdict-not-error, network,
  not-found, forbidden, traceId, guards, permissões/flags, shell lifecycle).
- e2e/*.feature existentes em `docs/architecture/frontend/modules/pub/frontend/e2e/` são os sources.
- Step definitions cobrem todos os slugs EARS (pub-export-trigger, pub-poll-status, ...).

**Approach (execution path):**
1. Criar `apps/pub-e2e/src/exportacao-e-validacao.feature` (copiar/promover de docs/).
2. Implementar step definitions em `apps/pub-e2e/src/steps/`:
   - Mock de API via Playwright route intercept (POST §4.1, GET §4.2, guards).
   - Step "a build is already in flight" → resposta 200 com status=gerando.
   - Step "Retry-After honoured" → check que a próxima chamada ocorre após o delay.
3. Executar `npx nx e2e pub-e2e --testFile=exportacao-e-validacao`.

**Non-goals:**
- Não implementa steps de T08 (FE-PUB-028).

**Layer(s):**
frontend / apps/pub-e2e

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§1 T07)
- `docs/architecture/frontend/modules/pub/frontend/e2e/exportacao-e-validacao.feature`

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:e2e`
- Playwright + route intercept; sem dependência de BE real

**Implementation checklist (by file):**

**App: apps/pub-e2e**
- 🔲 `apps/pub-e2e/src/exportacao-e-validacao.feature` (promovido)
- 🔲 `apps/pub-e2e/src/steps/exportacao-e-validacao.steps.ts`
- 🔲 Mock setup: POST §4.1 (202 + 200 idempotent), GET §4.2 (gerando → publicado)

**Tests**
- 🔲 `npx nx e2e pub-e2e` PASS (todos 19 cenários)

**Milestone:**
Wave 9 / P9 E2E + Hardening

**Labels:**
type:e2e
layer:frontend
scope:pub
priority:P9

**Acceptance criteria:**
- Todos 19 cenários SPEC-08 T07 PASS
- Cenário pub-progress-indeterminate: sem elemento DOM com "%" numérico
- Cenário pub-verdict-not-error: erros_criticos → banner (não toast)

**Dependencies:**
- FE-PUB-012..017 (feature-export + sub-componentes completos)

**Data impact:**
- Nenhum (testes E2E, sem persistência real)

**API / Contract impact:**
- Todos endpoints §4.1..§4.4 mockados via Playwright route

**Testing / Evidence required:**
- `npx nx e2e pub-e2e` exit 0

**Risks / Notes:**
- Steps de guards (outline) precisam de mocks de authGuard / accessGuard — confirmar que o App tem interceptor de teste configurado.
