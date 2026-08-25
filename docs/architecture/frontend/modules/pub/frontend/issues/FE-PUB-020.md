## [FE-PUB-020] PublicationHistoryListComponent, PublicationHistoryRowComponent, HistoryEmptyStateComponent, BackToLibraryLinkComponent

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui` contém os componentes presentacionais da lista de histórico de publicações (T08):
- `PublicationHistoryListComponent`: recebe `publicacoes: PublicacaoVM[]`, `versaoAtualId`; renderiza rows.
- `PublicationHistoryRowComponent`: uma linha por publicação — status icon/label, tag "versão atual" em index 0, botão "Baixar" (iff podeBaixar) ou "inválido".
- `HistoryEmptyStateComponent`: exibido quando publicacoes=[]; aponta para nova exportação.
- `BackToLibraryLinkComponent`: output `backToLibrary()`.

**Context / Problem statement:**
- SPEC-02 §2 define a hierarquia completa de T08.
- SPEC-03 §2 (PublicacaoVM): `podeBaixar = epubcheckStatus ∈ {valido, avisos}`; row "inválido" quando false.
- versaoAtualId = publicacoes[0]?.id (newest-first, server-ordered); tag "versão atual" no index 0.
- Gate de download (EARS pub-gate-download): disabled iff erros_criticos ou sem arquivoUrl.

**Approach (execution path):**
1. Criar `PublicationHistoryListComponent`: `input()` publicacoes, versaoAtualId; `@for` rows; `output()` baixar(publicacaoId).
2. Criar `PublicationHistoryRowComponent`: `input()` publicacao: PublicacaoVM, isVersaoAtual: boolean;
   `output()` baixar(publicacaoId); exibe status label + icon; botão "Baixar" iff podeBaixar.
3. Criar `HistoryEmptyStateComponent`: botão "Nova exportação" com output newExport.
4. Criar `BackToLibraryLinkComponent`: output backToLibrary.
5. Re-exportar via index.ts.

**Non-goals:**
- Não implementa paginação (não há paginação no MVP).
- Não filtra ou ordena (servidor já devolve newest-first).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; zero facade; dados via input signals

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/publication-history-list/publication-history-list.component.ts`
- 🔲 `libs/pub/ui/src/lib/publication-history-list/publication-history-list.component.html`
- 🔲 `libs/pub/ui/src/lib/publication-history-row/publication-history-row.component.ts`
- 🔲 `libs/pub/ui/src/lib/publication-history-row/publication-history-row.component.html`
- 🔲 `libs/pub/ui/src/lib/history-empty-state/history-empty-state.component.ts`
- 🔲 `libs/pub/ui/src/lib/history-empty-state/history-empty-state.component.html`
- 🔲 `libs/pub/ui/src/lib/back-to-library-link/back-to-library-link.component.ts`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (versão atual tag no index 0; row inválido sem botão Baixar; empty state quando lista=[])
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
- publicacoes[0] → tag "versão atual" visível
- erros_criticos row → botão "Baixar" disabled; label "inválido"
- publicacoes=[]: HistoryEmptyStateComponent exibido

**Dependencies:**
- FE-PUB-018 (DownloadEHistoricoComponent usa estes componentes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (dados via HistoryFacade → DownloadEHistoricoComponent)

**Testing / Evidence required:**
- DOM: data-testid="versao-atual-tag" apenas em index 0; "Baixar" disabled em erros_criticos

**Risks / Notes:**
- criadoEm renderizado em pt-BR (dd/MM/yyyy HH:mm) via Angular DatePipe com locale pt.
