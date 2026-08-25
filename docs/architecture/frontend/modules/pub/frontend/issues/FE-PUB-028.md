## [FE-PUB-028] Playwright e2e — T08 download-e-historico.feature (7 cenários SPEC-08)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/pub-e2e/src/download-e-historico.feature` promovido e step definitions implementadas.
Todos os 7 cenários do SPEC-08 T08 cobertos e passando.

**Context / Problem statement:**
- SPEC-08 §2: 7 cenários para T08 (versão atual, KPIs de stats, tile omitido, download signed URL,
  gate inválido, link expirado, artifact-not-available).
- e2e source: `docs/architecture/frontend/modules/pub/frontend/e2e/download-e-historico.feature`.

**Approach (execution path):**
1. Criar `apps/pub-e2e/src/download-e-historico.feature` (promovido de docs/).
2. Implementar step definitions:
   - Mock GET §4.3 (lista com variedade de epubcheckStatus)
   - Mock GET §4.5 (PublicationStats)
   - Mock GET §4.4 (signed URL: normal, expirado 401)
   - Assert: versão atual tag em index 0; "inválido" em erros_criticos row
3. Executar `npx nx e2e pub-e2e --testFile=download-e-historico`.

**Non-goals:**
- Não reimplementa cenários de T07 (FE-PUB-027).

**Layer(s):**
frontend / apps/pub-e2e

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§2 T08)
- `docs/architecture/frontend/modules/pub/frontend/e2e/download-e-historico.feature`

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:e2e`

**Implementation checklist (by file):**

**App: apps/pub-e2e**
- 🔲 `apps/pub-e2e/src/download-e-historico.feature` (promovido)
- 🔲 `apps/pub-e2e/src/steps/download-e-historico.steps.ts`
- 🔲 Mock: GET §4.3 (lista historico), §4.5 (stats), §4.4 (signed URL + 401 expirado)

**Tests**
- 🔲 `npx nx e2e pub-e2e` PASS (todos 7 cenários)

**Milestone:**
Wave 9 / P9 E2E + Hardening

**Labels:**
type:e2e
layer:frontend
scope:pub
priority:P9

**Acceptance criteria:**
- Todos 7 cenários SPEC-08 T08 PASS
- pub-versao-atual: tag "versão atual" em primeiro item
- pub-kpi-omit-missing: tile ausente quando null (sem valor fabricado)
- pub-download-expired-refetch: re-fetch automático disparado

**Dependencies:**
- FE-PUB-018..020 (feature-history + sub-componentes completos)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Endpoints §4.3, §4.4, §4.5 mockados

**Testing / Evidence required:**
- `npx nx e2e pub-e2e` exit 0

**Risks / Notes:**
- Confirmar que Playwright está configurado para pub-e2e em nx.json.
