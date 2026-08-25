## [FE-PUB-022] pubStatusGuard — modo export (em_composicao) e modo history (≥1 Publicacao)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/access/src/lib/guards/pub-status.guard.ts` implementa `pubStatusGuard(mode)`:
- modo **'export'**: admite T07 apenas para projeto em `em_composicao`; redireciona para PROJ senão.
- modo **'history'**: admite T08 para projeto com ≥1 `Publicacao`; exibe empty state senão
  (guard não bloqueia — empty state é tratado pelo HistoryFacade).

**Context / Problem statement:**
- SPEC-01 §3: pubStatusGuard faz gate client-side (servidor tem seu próprio pre-flight via 409/422).
- export mode: `em_composicao` é requisito para nova exportação.
- history mode: ≥1 Publicacao; empty state é delegado à view (guard não redireciona — resolve true).
- EARS: pub-guard-status-export, pub-guard-status-history.

**Approach (execution path):**
1. Criar `libs/pub/access/src/lib/guards/pub-status.guard.ts`:
   - Retorna uma factory `pubStatusGuard(mode: 'export'|'history'): CanActivateFn`
   - mode='export': GET projeto (cross-context PROJ); status !== 'em_composicao' → redirect PROJ
   - mode='history': resolve true (empty state tratado pela view via HistoryFacade.status=empty)

**Non-goals:**
- Não inventa endpoint de status de projeto (usa serviço de PROJ via cross-context).
- history mode nunca bloqueia navegação.

**Layer(s):**
frontend / libs/pub/access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` (§3 pubStatusGuard)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`
- Guard factory (CanActivateFn) parametrizado por modo

**Implementation checklist (by file):**

**Lib: libs/pub/access**
- 🔲 `libs/pub/access/src/lib/guards/pub-status.guard.ts`
- 🔲 `libs/pub/access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-access` PASS (export mode: em_composicao → true; publicado → redirect; history mode → sempre true)
- 🔲 `nx lint pub-access` PASS

**Milestone:**
Wave 5 / P5 Access Guards

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P5

**Acceptance criteria:**
- `npx nx test pub-access` PASS
- export mode + em_composicao: true
- export mode + publicado/com_erros: redirect PROJ
- history mode: sempre true (empty state é da view)

**Dependencies:**
- FE-PUB-002 (routes), INT-FE-PUB-002 (getProjetoHeader — cross-context)

**Data impact:**
- Nenhum

**API / Contract impact:**
- GET /api/proj/projetos/{projetoId} (status check — cross-context)

**Testing / Evidence required:**
- Fake http: projeto com status variado → guard resultado esperado

**Risks / Notes:**
- Confirmar que o guard tem acesso ao serviço de PROJ sem violar boundary Nx (import via interface shared ou via PublicacaoApiService.getProjetoHeader).
