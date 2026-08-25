## [FE-PROJ-022] Capacidade data-access LGPD — deleteProjeto sem affordance de UI (LGPD erasure)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/data-access` expõe `deleteProjeto(id: string): Observable<void>` (já implementado em
FE-PROJ-007) com documentação explícita de que a UI está **deferida**. Esta issue documenta a
capacidade, adiciona um teste de smoke do método e cria a nota arquitetural de que o trigger
de erasure é externo ao PROJ frontend no MVP.

**Context / Problem statement:**
- M4 handoff (D-G): erasure LGPD é leaf-first orquestrada (PUB→COMP→IMP→projeto_editorial).
  O backend expõe `DELETE /api/proj/projetos/{id}` como o passo final da cadeia.
- O FE de PROJ não tem affordance de UI para este endpoint no MVP (SPEC-05 §2, T02/T08 sem
  botão "Excluir").
- A capacidade de data-access deve existir para que o fluxo LGPD possa ser testado de ponta a
  ponta em ambientes de staging sem precisar chamar o backend diretamente.
- Um desenvolvedor que precisar ativar a UI deve encontrar aqui a documentação da intenção
  arquitetural e os critérios de quando desbloquear.

**Approach (execution path):**
1. Verificar que `ProjetoApiService.deleteProjeto(id)` existe e passa nos testes (FE-PROJ-007).
2. Adicionar comentário JSDoc no método:
   ```ts
   /**
    * LGPD erasure — data-access capacity.
    * UI deferred: no affordance in T02/T08 MVP (SPEC-05 §2, M4 handoff D-G).
    * Unblock: when LGPD UI is approved, add proj.delete permission check + confirmation modal.
    */
   ```
3. Adicionar teste de smoke: `deleteProjeto('uuid')` emite `DELETE /api/proj/projetos/uuid`.
4. Criar `docs/architecture/frontend/modules/proj/frontend/notes/lgpd-erasure-ui-deferred.md`
   com: contexto, precondições para ativar a UI, fluxo esperado (confirmação → DELETE → feedback).

**Non-goals:**
- Não implementa a UI (affordance deferida).
- Não implementa o fluxo de erasure cross-context (responsabilidade do BE).

**Layer(s):**
frontend / libs/proj/data-access (smoke test) + docs (nota arquitetural)

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§1 — delete row)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-05-tool-contract.md` (§2 — proj.delete reservado)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Sem affordance de UI: nenhum componente chama `deleteProjeto` (verificado por lint boundaries)

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 JSDoc em `ProjetoApiService.deleteProjeto` (UI deferred notice)
- 🔲 Smoke test: `deleteProjeto('uuid')` → `DELETE /api/proj/projetos/uuid`

**Docs**
- 🔲 `docs/architecture/frontend/modules/proj/frontend/notes/lgpd-erasure-ui-deferred.md`

**Tests**
- 🔲 `nx test proj-data-access` PASS — smoke do método DELETE

**Milestone:**
Wave 6 / P6 LGPD Capability

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P6

**Acceptance criteria:**
- `npx nx test proj-data-access` PASS
- `npx nx lint proj-data-access` PASS
- Nenhum componente de UI chama `deleteProjeto` (verificado por `nx affected --target=lint`)
- Nota arquitetural documenta precondições para ativar a UI

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService.deleteProjeto já implementado)

**Data impact:**
- `DELETE /api/proj/projetos/{id}` deleta o projeto e dispara erasure cross-context no BE

**API / Contract impact:**
- `DELETE /api/proj/projetos/{id}` (200 void | 404 | 5xx)

**Testing / Evidence required:**
- Smoke test passa; nenhum componente UI importa `deleteProjeto` diretamente

**Risks / Notes:**
- Quando a UI for ativada, adicionar confirmação modal (LGPD exige intenção explícita do usuário).
- O `proj.delete` (beScope `proj:delete`) já está reservado em `PROJ_PERMISSION_MAP` (FE-PROJ-001);
  apenas adicionar a affordance de UI e o check de permissão quando aprovado.
