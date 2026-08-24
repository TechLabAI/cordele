## [FE-IMP-006] DTOs e interfaces TypeScript — libs/imp/data-access/models

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/data-access/src/lib/models/` contém as interfaces TypeScript `ManuscritoDetail`,
`ContentTree`, `Block`, `UnparsedSegment`, `ManuscritoSummary`, `SegmentoCuradoriaDto` e
`ConfirmEstruturaResultDto` — matching estrutural com `api-contract.md §6` e §8.3 (addendum M4).

**Context / Problem statement:**
- SPEC-04 §4 e `backend-api-cross-link.md §3` definem que as interfaces FE devem ser match
  estrutural com o contrato BE. Drift é detectado na drift-guard.
- O addendum M4 adicionou `SegmentoCuradoriaDto` (resposta do ignore §8.1) e
  `ConfirmEstruturaResultDto` (resposta do confirm §8.2) ao contrato.
- Bloqueia: FE-IMP-007, FE-IMP-008, FE-IMP-009, FE-IMP-010, FE-IMP-011

**Approach (execution path):**
1. Criar `libs/imp/data-access/src/lib/models/manuscript.models.ts` com:
   - `ManuscritoDetail` §6.1 (id, projetoId, nomeArquivo, formato, totalCapitulos, totalImagens,
     trechosNaoParseados, estrutura: ContentTree)
   - `ContentTree` §6.2 (schemaVersion, chapters: Chapter[])
   - `Chapter`, `Section`, `Block` (union paragraph | image | unparsed)
   - `UnparsedSegment` com `reason` enum §6.3 (7 razões + `other` fallback)
   - `ManuscritoSummary` §6.4
2. Criar `libs/imp/data-access/src/lib/models/curadoria.models.ts` com:
   - `SegmentoCuradoriaDto` (manuscritoId, segmentoId, ignoredAt, ignoredBy)
   - `ConfirmEstruturaResultDto` (manuscritoId, projetoId, projetoStatus: 'em_composicao')
3. Re-exportar via `models/index.ts` → `data-access/index.ts`.
4. `UnparsedSegment.reason` como union type literal (fechar o enum — `other` é o fallback).

**Non-goals:**
- Não implementa serviços de HTTP (FE-IMP-007, FE-IMP-008, FE-IMP-009).
- Não implementa mapeamento para VMs (responsabilidade das facades FE-IMP-010, FE-IMP-011).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§4)
- `docs/architecture/frontend/modules/imp/frontend/contracts/backend-api-cross-link.md` (§3, §6)
- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` (§6, §8.3)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`
- Interfaces `readonly` — imutáveis

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/models/manuscript.models.ts`
- 🔲 `libs/imp/data-access/src/lib/models/curadoria.models.ts`
- 🔲 `libs/imp/data-access/src/lib/models/index.ts`
- 🔲 `libs/imp/data-access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test imp-data-access` PASS (TypeScript compilation sem erros)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P2

**Acceptance criteria:**
- `npx nx test imp-data-access` PASS
- `npx nx lint imp-data-access` PASS
- `npx nx build imp-data-access` PASS
- `UnparsedSegment.reason` é union com 7 valores enumerados + `other`
- `ConfirmEstruturaResultDto` existe com campo `projetoStatus`

**Dependencies:**
- (nenhuma — issue inaugural da camada data-access)

**Data impact:**
- Nenhum (só tipos)

**API / Contract impact:**
- `SegmentoCuradoriaDto` e `ConfirmEstruturaResultDto` devem ser atualizados se o addendum BE evoluir

**Testing / Evidence required:**
- TypeScript strict-mode compile sem erros é suficiente para interfaces puras

**Risks / Notes:**
- Comparar com `api-contract.md §8.3` no momento da implementação; o addendum pode ter adicionado
  campos após a escrita desta issue.
- `reason` enum: garantir que o fallback `other` está presente.
