## [INT-FE-IMP-003] Handoff para COMP — navegação pós-confirmação de estrutura

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Após `confirmEstrutura()` bem-sucedido (200 `ConfirmEstruturaResultDto`), `RevisaoDeEstruturaComponent`
navega para a rota COMP passando `projetoId` como query param. IMP não possui nem gerencia a rota COMP.

**Context / Problem statement:**
- SPEC-01 §2 define: `/imp/manuscritos/:mid/revisao --"Confirmar"--> [COMP] /comp/config?projetoId=...`
- O addendum M4 mudou "confirm" de "só navegação" para "POST + então navegação".
  O FE só navega após receber 200 do `POST /confirm-estrutura`.
- IMP nunca conhece a estrutura interna de COMP — só a rota de entrada.
- Se COMP ainda não estiver implementado, a navegação pode falhar graciosamente (sem erro crítico).

**Context / Approach:**
1. Em `RevisaoDeEstruturaComponent`, após `facade.confirmEstrutura()` emitir sucesso com `projetoId`:
   - `router.navigate(['/comp/config'], { queryParams: { projetoId } })`
2. Se `ConfirmEstruturaResultDto.projetoId` não estiver disponível, usar o `projetoId` já conhecido
   (do upload ou do route state).
3. Teste: mock `confirmEstrutura` → 200 com projetoId → verificar navigate chamado com URL correta.
4. Erro no confirm (422 status-advance-failed) → NOT navigate, exibir banner de erro.

**Non-goals:**
- Não implementa rota `/comp/config` (pertence ao módulo COMP).
- Não implementa `PROJ.AdvanceProjetoStatusUseCase` (BE concern).

**Layer(s):**
frontend / libs/imp/feature-review (RevisaoDeEstruturaComponent)

**Bounded context:**
imp + comp (integração)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-01-route-map.md` (§2)
- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` (§8.2)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `RevisaoDeEstruturaComponent`: router.navigate após confirmEstrutura OK
- 🔲 Erro de confirm → banner (sem navigate)

**Tests**
- 🔲 `nx test imp-feature-review` PASS (confirm OK → navigate para /comp/config?projetoId=;
  confirm 422 → NÃO navigate)
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 3 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- Confirm bem-sucedido → `Router.navigate(['/comp/config'], { queryParams: { projetoId } })`
- Confirm 422 → NOT navigate, banner de erro exibido

**Dependencies:**
- FE-IMP-011 (ReviewFacade.confirmEstrutura)
- FE-IMP-017 (RevisaoDeEstruturaComponent)

**Data impact:**
- Nenhum

**API / Contract impact:**
- POST /api/imp/manuscripts/{id}/confirm-estrutura (§8.2)

**Testing / Evidence required:**
- Spy em `Router.navigate` confirmando URL e queryParams

**Risks / Notes:**
- A rota `/comp/config` pode não existir ainda quando IMP for implementado.
  O navigate deve falhar graciosamente (Angular router não encontra a rota → 404 page, não crash).
