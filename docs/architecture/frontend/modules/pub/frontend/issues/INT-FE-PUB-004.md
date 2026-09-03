## [INT-FE-PUB-004] Lista detalhada de avisos — DESBLOQUEADA (PUB-016 BE entregue)

**Status:** 🔓 DESBLOQUEADA (2026-09-03) — PUB-016 BE entregue (10/10, score 93, gates verdes);
§4.6 no api-contract.md linha 249; ratificação FE dispensada pelo proprietário do projeto
(autorização explícita 2026-08-29). Rota viva em `GET /api/pub/projetos/:projetoId/publicacoes/
:publicacaoId/validation-messages`. Pronta para implementação (steps 3-6).
**GitHub:** [#TBD]

**Outcome:**
Quando o endpoint `GET .../publicacoes/{id}/avisos` (api-contract §4.6 proposto por PUB-016 BE)
for ratificado e aprovado pelo FE, esta issue adiciona a chamada em `PublicacaoApiService.getAvisos()`
e popula `ExportFacade.avisos: AvisoVM[]`. Até então, `avisos` permanece vazio (SPEC-03 §5).

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §6` GAP 1: endpoint de lista detalhada `{code,msg,local}`
  não está no api-contract §6 ratificado.
- BE abriu PUB-016 propondo §4.6 — **BLOQUEADO aguardando ratificação do FE**.
- FE **NÃO DEVE** chamar endpoint não ratificado. WarningsDetailsComponent (FE-PUB-016) exibe
  apenas contagens e "detalhes em breve" até esta issue ser desbloqueada.
- Esta issue vira **pré-requisito de promote** para o módulo PUB ter lista detalhada de avisos.

**Approach (execution path):**
1. ~~Aguardar aprovação do time FE da proposta §4.6 de PUB-016 BE.~~ **DISPENSADA** — autorização
   explícita do proprietário do projeto (2026-08-29), registrada em PUB-016.
2. ~~Emenda de `api-contract.md` com §4.6 ratificado.~~ **FEITO** — §4.6, linha 249.
3. Implementar `PublicacaoApiService.getAvisos(projetoId, publicacaoId)`: GET §4.6.
4. ExportFacade: chamar getAvisos após terminal válido/avisos; popular `avisos` signal.
5. WarningsDetailsComponent (FE-PUB-016): renderizar lista detalhada quando avisos.length > 0.
6. Atualizar `contracts/backend-api-cross-link.md §6` com GAP 1 fechado.

**Non-goals:**
- Não implementar nada antes da ratificação (risco de quebra de contrato).

**Layer(s):**
frontend / libs/pub/data-access + libs/pub/ui

**Bounded context:**
pub ↔ pub-service (BE)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§6 GAP 1)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§5)

**Milestone:**
Wave 4 / P4 Hub Integrations

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4

**Acceptance criteria:**
- §4.6 ratificado em api-contract.md
- getAvisos implementado e ExportFacade.avisos populado
- WarningsDetailsComponent exibe lista detalhada

**Dependencies:**
- PUB-016 BE (bloqueante — aprovação FE obrigatória antes de qualquer implementação)
- FE-PUB-007, FE-PUB-009, FE-PUB-016

**Risks / Notes:**
- ATENÇÃO ao path real: a spec acima falava em `.../avisos`, mas o endpoint entregue é
  `.../validation-messages` com query param opcional `severity=error|warning|info`, retornando
  `ValidationMessageItem[]` (`{ id, severity, code, message, location, ordem }`) ordenado por `ordem ASC`.
  O contrato real vence a spec escrita.
- 5 dos 10 itens do checklist de PUB-016 estão marcados sem evidência verificável (404 cross-tenant,
  filtro por severity, `pnpm test`). Exercitar o endpoint real antes de codar contra ele.
- Quando desbloqueada, criar uma sub-issue de implement e fechar esta como bloqueante resolvida.
