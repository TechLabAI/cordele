## [INT-FE-COMP-002] Integração FE ↔ comp-service — validação end-to-end do contrato

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
As facades de COMP (`MetadataFacade`, `LayoutFacade`) funcionam corretamente contra o
`comp-service` real (ou um mock fidedigno): GET/PUT metadados, GET/PUT layout,
GET preview-context, POST/DELETE capa — todos com os DTOs corretos e o tratamento de erros
esperado (400/409/413/415/422/5xx).

**Context / Problem statement:**
- Esta issue valida a integração FE ↔ BE após FE-COMP-006..FE-COMP-010 estarem prontos.
- Pontos críticos: body de PUT layout nunca contém `tipo=em-branco`; `materialized:false`
  no GET inicial; `409 manuscript-missing` no preview-context para projeto sem manuscrito;
  `422 override-ref-not-found` quando a referência de imagem sumiu.
- Pode usar contrato mock (MSW) ou ambiente de integração.

**Approach (execution path):**
1. Configurar MSW/Playwright route intercept com respostas fidelizadas ao api-contract §4/§5/§6.
2. Testar cada operação de `MetadadosApiService` e `LayoutApiService` contra o mock.
3. Verificar que o body de PUT layout (via `LayoutFacade.onExport()`) exclui stale e `em-branco`.
4. Verificar que `materialized:false` na resposta do GET hidrata o form/painel com defaults.
5. Verificar `409 manuscript-missing` → estado `empty` na Facade.

**Non-goals:**
- Não testa o BE (responsabilidade dos testes de SPEC-BE).
- Não faz load testing.

**Layer(s):**
frontend / libs/comp/data-access (integração com comp-service)

**Bounded context:**
comp ↔ comp-service

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§1..§5)
- `docs/architecture/backend/services/comp-service/contracts/api-contract.md` (§4..§6)

**Milestone:**
Wave 4 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- PUT layout sem `tipo=em-branco` (verificado no mock)
- `materialized:false` → defaults corretos nas facades
- `409 manuscript-missing` → `status='empty'` na LayoutFacade

**Dependencies:**
- FE-COMP-006..FE-COMP-010 (data access completo)

**Risks / Notes:**
- Prioridade alta de validar o body do PUT layout (risco de enviar `tipo=em-branco` por acidente).
