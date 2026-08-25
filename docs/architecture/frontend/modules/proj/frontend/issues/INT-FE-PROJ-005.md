## [INT-FE-PROJ-005] Integração PROJ←PUB — PublicationHistoryPort degradation, publications read

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Quando o `proj-service` retorna `publicacoes=[]` com `degraded:true` (PUB `PublicationHistoryPort`
indisponível), a tela T08 exibe o notice correto e **não** entra em estado de erro. O stub do port
do BE garante que o FE pode testar este cenário sem PUB real.

**Context / Problem statement:**
- M2 handoff (D-E): `PublicationHistoryPort` é read-model sobre `Publicacao` do PUB; se o PUB
  estiver degradado, `proj-service` retorna `publicacoes: [], degraded: true` em vez de falhar.
- FE-PROJ-021 implementa a UI do notice de degradação; esta issue garante a integração E2E:
  que o BE efectivamente retorna o payload degradado e que o FE o processa correctamente.
- Sem PUB real, os testes devem usar fixture de resposta degradada.

**Approach (execution path):**
1. Criar fixture de resposta degradada:
   ```json
   { "projetos": [...], "degraded": true }
   ```
   para `GET /api/proj/projetos` e fixture análoga para `GET .../publicacoes`.
2. Testar `HistoryFacade.load()` com a fixture degradada: verifica `degraded()===true` e
   `publications()===[]` e `status()==='ready'`.
3. Testar `BibliotecaDeProjetosComponent` com a fixture degradada da biblioteca (campos null + degraded).
4. Documentar que o BE stub do `PublicationHistoryPort` é necessário para o scaffold (M5).

**Non-goals:**
- Não implementa `PublicationHistoryPort` no BE (responsabilidade de `proj-service`/PUB).
- Não implementa a UI do notice (FE-PROJ-021).

**Layer(s):**
frontend / libs/proj/data-access + libs/proj/feature-history

**Bounded context:**
proj ← pub (cross-context read, degraded)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2 — HistoryFacade degraded branch)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 Fixture de resposta degradada: `libs/proj/data-access/src/testing/history-degraded.fixture.ts`
- 🔲 Fixture de biblioteca degradada: `libs/proj/data-access/src/testing/library-degraded.fixture.ts`

**Tests**
- 🔲 `nx test proj-data-access` PASS — fixture degradada T08 → `degraded()===true`, `status()==='ready'`
- 🔲 `nx test proj-feature-history` PASS — fixture degradada → notice visível, sem error state
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 4 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- `HistoryFacade` com payload degradado: `status() === 'ready'` (nunca `error`)
- `publications() === []` com `degraded() === true` → notice renderizado
- Fixture reutilizada em FE-PROJ-025 (e2e)

**Dependencies:**
- FE-PROJ-010 (HistoryFacade)
- FE-PROJ-021 (UI degradation)

**Data impact:**
- Nenhum (fixtures de teste)

**API / Contract impact:**
- `GET /api/proj/projetos/{id}/publicacoes` — formato de resposta degradada

**Testing / Evidence required:**
- Teste de integração facade + fixture; `status()` signal permanece `ready`

**Risks / Notes:**
- O formato exato do payload degradado (`{ publicacoes: [], degraded: true }` vs flag no header)
  deve ser confirmado com o `proj-service` api-contract §4.3 antes de criar a fixture.
- Enquanto PUB não existir, o stub do `PublicationHistoryPort` no BE retorna lista vazia sem
  `degraded:true` — verificar que o FE não interpreta isso como degradação.
