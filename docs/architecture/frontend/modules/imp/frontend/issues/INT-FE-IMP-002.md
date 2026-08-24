## [INT-FE-IMP-002] Integração PROJ in-process — CreateProjetoEditorialUseCase via upload

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
O upload com `projetoTitulo` (binding kind='create') dispara `CreateProjetoEditorialUseCase` no
servidor via o campo `projetoTitulo` do `POST /api/imp/manuscripts`. O FE não faz chamada separada
ao PROJ — a criação é in-process no BE. O `projetoId` retornado no body 201 é o do projeto criado.

**Context / Problem statement:**
- `api-contract.md §0 D-C` e `integration-contracts.md §3` definem que IMP cria projeto
  in-process quando `projetoTitulo` está presente. O FE não deve fazer POST separado ao PROJ.
- O `ManuscritoDetail.projetoId` do body 201 é o ID do projeto criado (ou do existente se
  `projetoId` foi passado).
- `ReviewFacade` deve usar este `projetoId` para o handoff ao COMP.

**Context / Approach:**
1. Confirmar que `ImportFacade.submit()` captura `projetoId` do body 201 e popula o signal.
2. Verificar que `UploadComponent` passa `projetoId` para o Router state ao navegar para T04.
3. Verificar que `RevisaoDeEstruturaComponent` passa `projetoId` para `confirmEstrutura()` e para a
   navegação ao COMP.
4. Teste de integração: mock POST retorna `{ projetoId: 'uuid-new' }` → verificar que o facade
   expõe esse `projetoId` após `state='done'`.

**Non-goals:**
- Não implementa PROJ nem `CreateProjetoEditorialUseCase` (pertence ao módulo PROJ e ao BE).

**Layer(s):**
frontend / libs/imp/data-access (ImportFacade), libs/imp/feature-upload (UploadComponent)

**Bounded context:**
imp + proj (integração)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/contracts/backend-api-cross-link.md` (§2)
- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` (§0, §4.1)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `ImportFacade`: `projetoId` signal populado do body 201

**Tests**
- 🔲 `nx test imp-data-access` PASS (projetoId do body 201 disponível após done)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- `projetoId` acessível via `ImportFacade.projetoId()` após upload bem-sucedido
- FE NÃO faz chamada separada ao PROJ para criar projeto

**Dependencies:**
- FE-IMP-010 (ImportFacade)

**Data impact:**
- Nenhum

**API / Contract impact:**
- POST /api/imp/manuscripts (body 201 retorna projetoId)

**Testing / Evidence required:**
- Teste confirma que `projetoId` populado de `HttpResponse.body.projetoId`

**Risks / Notes:**
- Se o stub do `PROJ.CreateProjetoEditorialUseCase` retornar um projetoId diferente em testes
  de integração BE, o FE deve usar o valor retornado pelo server (nunca gerar client-side).
