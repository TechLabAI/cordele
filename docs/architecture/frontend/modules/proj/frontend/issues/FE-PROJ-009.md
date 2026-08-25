## [FE-PROJ-009] LibraryFacade — signals, state machine, empresa-switch

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/data-access` expõe `LibraryFacade` com state machine `loading|ready|empty|error` via signals
Angular. Re-fetch na reentrada da rota e cancelamento automático na troca de empresa são garantidos.
A facade nunca serve dados de cache (ADR-PROJ-001).

**Context / Problem statement:**
- SPEC-04 §2 define a state machine da `LibraryFacade` e o comportamento de `switchMap`/`takeUntilDestroyed`.
- A lista deve ser re-buscada em **cada** entrada na rota `/biblioteca-de-projetos` — não há broker
  para invalidar cache cross-module (ADR-PROJ-001 / doc 05 §3).
- `degraded:true` na resposta faz a facade entrar em `ready` (não `error`) com sinais de degradação.
- Bloqueia: FE-PROJ-012 (BibliotecaDeProjetosComponent consome a facade)

**Approach (execution path):**
1. Criar `libs/proj/data-access/src/lib/library.facade.ts`:
   - Sinais: `status = signal<LibraryStatus>('loading')`, `projects = signal<ProjetoCardVM[]>([])`,
     `isEmpty = computed(() => status() === 'ready' && projects().length === 0)`,
     `degraded = signal<boolean>(false)`, `empresaNome = signal<string>('')`.
   - `load()`: cancela in-flight via `switchMap`, chama `ProjetoApiService.listProjetos()`,
     mapeia DTOs via `mapProjetoCardToVM`, ordena por `ultimaAtividadeEm desc`, seta `status`.
   - Na troca de empresa (`empresaGuard` emite novo valor), chama `load()` novamente.
   - `cancelInFlight()`: chamado por `projDestroy()` — usa `takeUntilDestroyed` ou subject de destroy.
   - `retry()`: reseta para `loading` e reemite.
2. Expor `LibraryVM` como readonly signals.

**Non-goals:**
- Não pré-carrega no bootstrap (projInit não chama load() — SPEC-06 §3).
- Não armazena cache entre rotas.

**Layer(s):**
frontend / libs/proj/data-access

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2, diagrama LibraryFacade)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Signals-first; sem RxJS externo nos componentes
- `takeUntilDestroyed` para cancelamento automático no destroy do injection context

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `libs/proj/data-access/src/lib/library.facade.ts`
- 🔲 `libs/proj/data-access/src/index.ts` (exporta `LibraryFacade`)

**Tests**
- 🔲 `nx test proj-data-access` PASS — `load()` emite GET; em 200 → `status() === 'ready'`
- 🔲 `nx test proj-data-access` PASS — lista vazia → `status() === 'empty'` (não `ready`)
- 🔲 `nx test proj-data-access` PASS — `degraded:true` → `status() === 'ready'` + `degraded() === true`
- 🔲 `nx test proj-data-access` PASS — 5xx → `status() === 'error'`
- 🔲 `nx test proj-data-access` PASS — empresa muda → request anterior cancelado + novo load()
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
- `isEmpty()` só é `true` quando `status() === 'ready'` (não durante loading)
- Lista ordenada por `ultimaAtividadeEm desc` (verificado por teste com fixture desordenada)

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService)
- FE-PROJ-008 (mappers e DTOs)

**Data impact:**
- Nenhum

**API / Contract impact:**
- `GET /api/proj/projetos`

**Testing / Evidence required:**
- Testes com `HttpClientTestingModule` + `TestBed` (injeção de contexto para signals)

**Risks / Notes:**
- O padrão `switchMap` garante cancelamento automático; verificar que o Jest environment suporta
  signals do Angular 17+ (pode exigir `TestBed.runInInjectionContext`).
