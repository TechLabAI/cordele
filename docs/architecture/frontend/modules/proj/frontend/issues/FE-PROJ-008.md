## [FE-PROJ-008] DTOs + mapeamento ProblemDetail→AppError

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/data-access` define os DTOs (`ProjetoCard`, `ProjetoDetail`, `PublicacaoHistoryItem`) alinhados
com `api-contract.md §6`, e os mappers DTO→VM usados pelas facades. O mapeamento de erros URN→`AppError`
(SPEC-07 §1) é validado por testes unitários.

**Context / Problem statement:**
- SPEC-04 §4 define os DTOs e as regras de mapeamento DTO→VM (campos computados: `badge`, `canQuickDownload`,
  `openTarget`, `isCurrent`, `canDownload`, `statusLabel`).
- SPEC-07 §1 lista a tabela de URNs e seus tratamentos de UI.
- Os DTOs são espelhos do api-contract §6; divergências futuras são detectadas por testes de shape.
- Bloqueia: FE-PROJ-009, FE-PROJ-010 (facades usam mappers), FE-PROJ-013 (badge derivation)

**Approach (execution path):**
1. Criar `libs/proj/data-access/src/lib/models/`:
   - `projeto-card.dto.ts` (espelho de api-contract §6.2 — inclui `degraded?: boolean`)
   - `projeto-detail.dto.ts` (api-contract §6.1)
   - `publicacao-history-item.dto.ts` (api-contract §6.3)
2. Criar mappers:
   - `mapProjetoCardToVM(dto: ProjetoCard): ProjetoCardVM` — calcula `badge` (SPEC-03 §3), `canQuickDownload`, `openTarget`.
   - `mapProjetoDetailToHeaderVM(dto: ProjetoDetail): ProjectHeaderVM`.
   - `mapPublicacaoToRowVM(dto: PublicacaoHistoryItem, index: number): PublicacaoRowVM` — calcula `isCurrent` (index===0), `canDownload` (arquivoUrl != null), `statusLabel`.
3. Definir `AppErrorCode` enum cobrindo os URNs de SPEC-07 §1 (6 URNs + fallback).

**Non-goals:**
- Não implementa o interceptor `ErrorNormalize` (responsabilidade de `@cordele/shared/access-http-base`).
- Não implementa a lógica de degradação na UI (FE-PROJ-020).

**Layer(s):**
frontend / libs/proj/data-access

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§4, §5)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§1, §2, §3)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Funções puras (sem injeção) — fáceis de testar e compor

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `libs/proj/data-access/src/lib/models/projeto-card.dto.ts`
- 🔲 `libs/proj/data-access/src/lib/models/projeto-detail.dto.ts`
- 🔲 `libs/proj/data-access/src/lib/models/publicacao-history-item.dto.ts`
- 🔲 `libs/proj/data-access/src/lib/mappers/projeto-card.mapper.ts`
- 🔲 `libs/proj/data-access/src/lib/mappers/projeto-detail.mapper.ts`
- 🔲 `libs/proj/data-access/src/lib/mappers/publicacao-row.mapper.ts`
- 🔲 `libs/proj/data-access/src/lib/models/app-error-code.enum.ts`
- 🔲 `libs/proj/data-access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test proj-data-access` PASS — badge derivation: cada combinação status/epubcheck → tone correto
- 🔲 `nx test proj-data-access` PASS — `canDownload = (arquivoUrl != null)` (não recomputa de status)
- 🔲 `nx test proj-data-access` PASS — `isCurrent` só no primeiro item da lista
- 🔲 `nx test proj-data-access` PASS — `openTarget` cobre os 4 status sem dead-end
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P2

**Acceptance criteria:**
- `npx nx test proj-data-access` PASS
- `npx nx lint proj-data-access` PASS
- Mapper `mapProjetoCardToVM` cobre os 6 casos de badge (draft, progress, valid, warn, error, pending)
- `canDownload` derivado exclusivamente de `arquivoUrl != null` (SPEC-03 §2)

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService usa os DTOs)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Alinhado a api-contract §6 (ProjetoCard, ProjetoDetail, PublicacaoHistoryItem)

**Testing / Evidence required:**
- Tabela de testes parametrizados para badge derivation (6 combinações)

**Risks / Notes:**
- Se api-contract §6 mudar o shape de `ProjetoCard.degraded`, os DTOs devem refletir a mudança;
  adicionar campo `degraded?: boolean` desde o início para evitar refactor futuro.
