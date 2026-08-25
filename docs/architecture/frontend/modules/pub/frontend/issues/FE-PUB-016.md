## [FE-PUB-016] WarningsDetailsComponent — contagens + resumoErro; lista detalhada bloqueada (PUB-016 BE gap)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui/src/lib/warnings-details/warnings-details.component.ts` renderiza o expandable
`<details>` de avisos não-bloqueantes. No MVP: exibe apenas `totalAvisos` e `resumoErro`
(disponíveis no api-contract §6.1). A lista detalhada `{ code, msg, local }` (do protótipo
`AVISOS_MOCK`) permanece **vazia** até que o endpoint §4.6 seja ratificado e aprovado pelo FE
(dependência de PUB-016 BE, bloqueada).

**Context / Problem statement:**
- SPEC-03 §5 e `backend-api-cross-link.md §6` GAP 1: `GET .../publicacoes/{id}/avisos` não existe
  no api-contract §6 ratificado. Contagens (`totalAvisos`) e `resumoErro` estão disponíveis.
- BE abriu PUB-016 propondo api-contract §4.6 — BLOQUEADO aguardando ratificação do FE.
- FE **não deve chamar** endpoint não-ratificado; `avisos: AvisoVM[]` permanece vazio no MVP.
- O protótipo usava `AVISOS_MOCK` — removido em FE-PUB-012.
- INT-FE-PUB-004 documenta a dependência bloqueante.

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/warnings-details/warnings-details.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: totalAvisos: number, avisos: AvisoVM[], resumoErro: string | null
   - `@if (totalAvisos > 0)`: exibe `<details>` expandable com contagem no summary
   - Corpo do `<details>`: se `avisos.length > 0` → lista `{code, msg, local}`; senão → texto "Detalhes de aviso disponíveis em breve"
   - Nunca exibe dado fabricado ou hardcoded de avisos

**Non-goals:**
- Não chama endpoint de avisos (endpoint não ratificado — INT-FE-PUB-004).
- Não exibe AVISOS_MOCK.

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§5)
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§6 GAP 1)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; avisos sempre via input (nunca HTTP direto)

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/warnings-details/warnings-details.component.ts`
- 🔲 `libs/pub/ui/src/lib/warnings-details/warnings-details.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (totalAvisos=2, avisos=[]: mensagem "em breve" visível, sem dados fabricados)
- 🔲 `nx lint pub-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-ui` PASS
- avisos=[]: `<details>` mostra contagem + texto "em breve"; sem linha fabricada
- avisos=[{code,msg,local}]: lista renderizada
- totalAvisos=0: `<details>` não renderizado

**Dependencies:**
- FE-PUB-012, INT-FE-PUB-004 (ratificação §4.6 — bloqueante para lista detalhada)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum no MVP (aguarda §4.6 ratificado)

**Testing / Evidence required:**
- DOM: sem item de aviso fabricado quando avisos=[]

**Risks / Notes:**
- NÃO implementar chamada a endpoint §4.6 até ratificação aprovada (PUB-016 BE → aprovação FE → emenda api-contract). Ver INT-FE-PUB-004.
