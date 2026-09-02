## [INT-FE-PUB-005] KPIs de resumo ePub — decisão de produto tomada (ADR-004); implementação pendente

**Status:** 🔓 DESBLOQUEADA — decisão registrada (ADR-004 / api-contract D-S, 2026-09-01); pronta para
implementação (steps 3-4 abaixo)
**GitHub:** [#TBD]

**Outcome:**
Fecha a decisão de produto para os KPI tiles de `EpubSummaryVM` em T07: Tamanho/Capítulos/Imagens
ganham campo-fonte em `PublicacaoStatus` (§6.1); Páginas fica **permanentemente** omitido (não é mais
gap, é decisão). Enquanto a implementação (steps 3-4) não landa, os tiles de Tamanho/Capítulos/Imagens
continuam omitidos na prática (campo ainda não populado pelo BE) — mesmo comportamento
`pub-kpi-omit-missing` de antes, agora transitório em vez de permanente para esses três.

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §6` GAP 2 — **RESOLVIDO**: `Tamanho/Capítulos/Imagens` agora têm
  campo-fonte em `api-contract.md §6.1` (`PublicacaoStatus.tamanhoBytes/.totalCapitulos/.totalImagens`,
  não-nulo iff `status=publicado`). `Páginas` não terá campo — ePub reflowable não tem paginação fixa
  (ADR-004, decisão de produto, não uma fonte a determinar).
- O protótipo hardcodava esses valores — removidos em FE-PUB-012 (promote).
- EpubSummaryGridComponent (FE-PUB-015) já trata `null` corretamente (tile oculto) — nenhuma mudança de
  comportamento necessária ali além de consumir os novos campos.
- Fonte definida: BE (`pub-service`) conta capítulos/imagens durante o walk que `EpubBuilder` já faz via
  `ManuscriptContentPort` (nenhuma porta nova cross-context) e mede o tamanho do `.epub` na escrita em
  `FileStoragePort`. Ver `PUB-021` / `adr/ADR-004-epub-summary-kpi-field-sources.md`.

**Approach (execution path):**
1. ~~[DECISÃO DE PRODUTO] Definir fonte dos campos Tamanho/Páginas/Capítulos/Imagens.~~ **FEITO** —
   ADR-004 / api-contract D-S.
2. ~~Emenda de api-contract.md §6 com os novos campos na resposta adequada.~~ **FEITO** — §6.1
   `PublicacaoStatus` (não §6.2, ver D-S).
3. Atualizar modelos TS em `libs/pub/data-access/models` (`tamanhoBytes`, `totalCapitulos`,
   `totalImagens` em `PublicacaoStatus`). **Pendente** — depende do BE (`pub-service`) implementar a
   emenda de contrato (`EpubBuilder` popular as 3 colunas no assembly).
4. ExportFacade: popular `summary` (`EpubSummaryVM`) com os campos quando disponíveis; `tamanho` formatado
   (`formatBytes`), `paginas` fixo em `null`. **Pendente**.
5. ~~Atualizar `contracts/backend-api-cross-link.md §6` com GAP 2 fechado.~~ **FEITO**.

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
