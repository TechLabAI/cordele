## [FE-COMP-008] MetadataFacade — signals, state machine T05, eventos de UI

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/data-access/src/lib/metadata.facade.ts` implementa `MetadataFacade` com signals
readonly (`status`, `form`, `cover`, `materialized`, `canAdvance`, `fieldErrors`) e os
5 métodos de UI: `onFieldChange`, `onCoverSelect`, `onCoverRemove`, `onAdvanceToLayout`,
`onRetry`. Estado gerido por máquina de estados (loading → ready/error; saving em avanço).

**Context / Problem statement:**
- SPEC-03 §1 define `MetadataVM` completo.
- SPEC-04 §2 define a máquina de estados (loading/ready/error/saving) e os sub-estados
  de capa (uploading, objectUrl, error).
- Defaults lazy: `materialized:false` → form com `idioma='pt'` e campos vazios (D-M).
- `canAdvance = titulo && autor não-vazios && idioma ∈ {pt,en,es,fr}`.
- Avanço pessimista: PUT awaita 200 antes de navegar; falha preserva edições locais.
- Bloqueia: FE-COMP-011 (ConfiguracoesComponent)

**Approach (execution path):**
1. Criar `MetadataFacade` como `@Injectable({ providedIn: 'root' })`.
2. Signals privados: `_status`, `_form`, `_cover`; expostos via `.asReadonly()`.
3. Computed: `canAdvance = computed(() => ...)`, `fieldErrors = computed(() => ...)`.
4. `onRetry()`: re-issue `getMetadados(projetoId)`.
5. `onFieldChange(field, value)`: update `_form` signal localmente (sem rede).
6. `onCoverSelect(file)`: `status=uploading` → POST capa → swap objectUrl→capaUrl; inline error em 413/415.
7. `onCoverRemove()`: DELETE capa → `capaUrl=null`.
8. `onAdvanceToLayout()`: `status=saving` → PUT metadados → 200 → `router.navigate(T06)`.
   - Falha 400: inline field errors; falha 5xx: toast, edições preservadas.
9. Cancelar requests com `takeUntilDestroyed` na saída de rota.

**Non-goals:**
- Não implementa componentes (FE-COMP-011, FE-COMP-012).
- Não faz optimistic update (escrita sempre pessimista).
- Não guarda estado cross-module (ADR-COMP-001).

**Layer(s):**
frontend / libs/comp/data-access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-03-view-models.md` (§1)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-04-data-access.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:data-access`
- Signals-first; sem NgRx; `computed()` para canAdvance e fieldErrors
- `switchMap` para garantir cancelamento de GET em re-entrada de rota

**Implementation checklist (by file):**

**Lib: libs/comp/data-access**
- 🔲 `libs/comp/data-access/src/lib/metadata.facade.ts`
- 🔲 `libs/comp/data-access/src/index.ts` (re-export MetadataFacade)

**Tests**
- 🔲 `nx test comp-data-access` PASS
  - `canAdvance` falso quando titulo vazio
  - `status=saving` durante PUT; restaurado em falha
  - Cover 413/415 → `cover.error` correto; form intacto
- 🔲 `nx lint comp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data access

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P2

**Acceptance criteria:**
- `npx nx test comp-data-access` PASS
- `canAdvance` retorna false quando titulo ou autor vazio ou idioma inválido
- Falha do PUT de avanço não navega e preserva estado do formulário
- `materialized:false` → form com defaults (`idioma='pt'`)

**Dependencies:**
- FE-COMP-006 (MetadadosApiService)

**Data impact:**
- Nenhum (estado de UI local; persiste no PUT a pedido do utilizador)

**API / Contract impact:**
- Chama `MetadadosApiService` (FE-COMP-006)

**Testing / Evidence required:**
- Teste de estado: entrada → loading → ready; advance → saving → ready (falha) / navigate (sucesso)
- Teste de defaults lazy

**Risks / Notes:**
- `onCoverSelect` deve criar e revogar `URL.createObjectURL` para evitar memory leak.
