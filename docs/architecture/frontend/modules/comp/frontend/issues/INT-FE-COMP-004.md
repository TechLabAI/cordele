## [INT-FE-COMP-004] Integração COMP ↔ PUB — navegação "Exportar" para /exportacao-e-validacao

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
O botão "Exportar" em T06 navega corretamente para PUB `/exportacao-e-validacao?projetoId={id}`
após o PUT layout com sucesso. COMP **nunca** muda o status do projeto; a mudança de status
é responsabilidade do PUB/PROJ. A rota PUB aceita o `projetoId` como query param.

**Context / Problem statement:**
- SPEC-01 §2: "Exportar" = navegação, não status write (api-contract §0 D-M).
- O PUB deve aceitar `projetoId` como query param na rota `/exportacao-e-validacao`.
- Se o PUB ainda não expõe essa rota, este ponto de integração fica bloqueado.
- Confirmar que o router guard de PUB não bloqueia projetos em `em_composicao`
  (a mudança de status ocorre dentro do PUB).

**Approach (execution path):**
1. Em `LayoutFacade.onExport()`, após `200` do PUT layout, chamar:
   `router.navigate(['/exportacao-e-validacao'], { queryParams: { projetoId } })`.
2. Verificar que a rota `/exportacao-e-validacao` está registrada no PUB com o guard correto.
3. Testar navegação end-to-end (mock do PUT → navigate → landing no PUB).
4. Confirmar que COMP não emite nenhum evento de mudança de status.

**Non-goals:**
- Não implementa a rota PUB (responsabilidade do módulo PUB).
- Não implementa a lógica de publicação.

**Layer(s):**
frontend / libs/comp/data-access (LayoutFacade) + apps/cordele-web (routing)

**Bounded context:**
comp ↔ pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§2 "Exportar")
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§3)

**Milestone:**
Wave 4 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- "Exportar" navega para `/exportacao-e-validacao?projetoId={id}` após PUT 200
- COMP não emite nenhum evento de mudança de status (verificado por spy)
- Rota PUB aceita o projetoId

**Dependencies:**
- FE-COMP-009 (LayoutFacade onExport), FE-COMP-017 (ExportBarComponent)

**Risks / Notes:**
- Verificar com o módulo PUB que `/exportacao-e-validacao` existe e aceita `?projetoId=`; se ainda não existe, marcar como bloqueador externo e usar um redirect placeholder.
