## [INT-FE-PUB-005] KPIs de resumo ePub — decisão de produto pendente; tile omitido, nunca fabricado

**Status:** 🔲 ABERTA — decisão de produto pendente
**GitHub:** [#TBD]

**Outcome:**
Documenta o gap de produto para os KPI tiles de `EpubSummaryVM` (Tamanho/Páginas/Capítulos/Imagens)
em T07. Define o requisito de uma decisão de produto + emenda de api-contract antes de qualquer
implementação dos tiles. Até então, os tiles são omitidos (não exibidos, não fabricados) — conforme
SPEC-03 §3 e EARS pub-kpi-omit-missing.

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §6` GAP 2: `Tamanho/Páginas/Capítulos/Imagens` não têm
  campo-fonte em `api-contract.md §6` (nem em PublicacaoStatus §6.1, nem em PublicacaoHistoryItem §6.2).
- O protótipo hardcodava esses valores — removidos em FE-PUB-012 (promote).
- EpubSummaryGridComponent (FE-PUB-015) já trata `null` corretamente (tile oculto).
- Decisão de produto pendente: reconciliar fonte (build metadata do pub-service vs contagem de Manuscrito vs field novo).

**Approach (execution path):**
1. [DECISÃO DE PRODUTO] Definir fonte dos campos Tamanho/Páginas/Capítulos/Imagens.
2. Emenda de api-contract.md §6 com os novos campos na resposta adequada.
3. Atualizar modelos TS em `libs/pub/data-access/models`.
4. ExportFacade: popular `summary` com os campos quando disponíveis.
5. Atualizar `contracts/backend-api-cross-link.md §6` com GAP 2 fechado.

**Non-goals:**
- Não inventar campos enquanto a decisão não for tomada.
- Não exibir valores default como "N/D" ou "--".

**Layer(s):**
frontend / libs/pub/data-access + libs/pub/ui

**Bounded context:**
pub ↔ pub-service (BE)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§6 GAP 2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§3)

**Milestone:**
Wave 4 / P4 Hub Integrations (pendente — decisão de produto)

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4
blocked:produto

**Acceptance criteria:**
- Decisão de produto documentada
- api-contract.md emendado com campos fonte
- EpubSummaryGridComponent exibe tiles quando campos disponíveis

**Dependencies:**
- FE-PUB-015 (EpubSummaryGridComponent com null-safety)
- Decisão de produto (owner: PM/Tech Lead)

**Risks / Notes:**
- Fonte mais provável: metadata do arquivo .epub gerado (tamanho em bytes) + contagens do ManuscriptoPort (capítulos, imagens). Confirmar com BE antes de propor emenda.
