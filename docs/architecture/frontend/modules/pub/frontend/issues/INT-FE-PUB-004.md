## [INT-FE-PUB-004] Ratificação §4.6 lista detalhada de avisos — BLOQUEADO (PUB-016 BE pendente)

**Status:** 🔲 ABERTA — BLOQUEADA (aguarda aprovação FE de PUB-016 BE)
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
1. [BLOQUEADO] Aguardar aprovação do time FE da proposta §4.6 de PUB-016 BE.
2. Emenda de `api-contract.md` com §4.6 ratificado.
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
Wave 4 / P4 Hub Integrations (BLOQUEADA — M4 gap)

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4
blocked:PUB-016

**Acceptance criteria:**
- §4.6 ratificado em api-contract.md
- getAvisos implementado e ExportFacade.avisos populado
- WarningsDetailsComponent exibe lista detalhada

**Dependencies:**
- PUB-016 BE (bloqueante — aprovação FE obrigatória antes de qualquer implementação)
- FE-PUB-007, FE-PUB-009, FE-PUB-016

**Risks / Notes:**
- NÃO implementar em produção sem aprovação do time FE de PUB-016 (contrato §4.6 inexistente no api-contract atual).
- Quando desbloqueada, criar uma sub-issue de implement e fechar esta como bloqueante resolvida.
