## [FE-PROJ-007] ProjetoApiService — 7 endpoints do proj-service

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/data-access` expõe `ProjetoApiService` com os 7 métodos correspondentes aos endpoints do
`proj-service` (api-contract §4). Componentes e facades nunca tocam `HttpClient` diretamente.
A capacidade `deleteProjeto` (LGPD) é implementada na camada de data-access **sem affordance de UI**.

**Context / Problem statement:**
- SPEC-04 §1 define a tabela mestre de recursos com 6 operações + download (7 no total).
- Tenancy é resolvida server-side pelo JWT `empresa` claim — PROJ não passa `X-Empresa-Id` no body/path.
- `DELETE /api/proj/projetos/{projetoId}` (LGPD erasure) não tem UI no MVP, mas o method deve existir
  para que o fluxo de erasure backend seja testável e o scaffolding seja completo (M4 handoff D-G).
- Bloqueia: FE-PROJ-009 (LibraryFacade), FE-PROJ-010 (HistoryFacade), FE-PROJ-022 (LGPD capability)

**Approach (execution path):**
1. Criar `libs/proj/data-access/src/lib/projeto-api.service.ts` estendendo `@cordele/shared/access-http-base`:
   - `listProjetos(): Observable<ProjetoCard[]>` → `GET /api/proj/projetos`
   - `getProjeto(id: string): Observable<ProjetoDetail>` → `GET /api/proj/projetos/{id}`
   - `listPublicacoes(id: string): Observable<PublicacaoHistoryItem[]>` → `GET /api/proj/projetos/{id}/publicacoes`
   - `resolveDownloadUrl(projetoId, publicacaoId): Observable<{ arquivoUrl: string; expiresAt: string }>` → `GET /api/proj/projetos/{id}/publicacoes/{pid}/download`
   - `reopen(id: string): Observable<ProjetoDetail>` → `POST /api/proj/projetos/{id}/reopen`
   - `deleteProjeto(id: string): Observable<void>` → `DELETE /api/proj/projetos/{id}` **(LGPD — sem UI no MVP)**
2. Injetar `HttpClient` via `@cordele/shared/access-http-base` (nunca diretamente).
3. Todos os erros propagam como `AppError` via `ErrorNormalize` interceptor (INT-FE-PROJ-001).

**Non-goals:**
- Não implementa cache — re-fetch em cada chamada (ADR-PROJ-001).
- Não expõe `deleteProjeto` na UI (LGPD erasure UI deferida).

**Layer(s):**
frontend / libs/proj/data-access

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §3)
- `docs/architecture/frontend/modules/proj/frontend/contracts/backend-api-cross-link.md`

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Standalone + providedIn root (ou `libs/proj/data-access` providers)

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `libs/proj/data-access/src/lib/projeto-api.service.ts` (6 métodos + delete LGPD)
- 🔲 `libs/proj/data-access/src/index.ts` (exporta `ProjetoApiService`)

**Tests**
- 🔲 `nx test proj-data-access` PASS — cada método usa `HttpTestingController.expectOne` com URL correta
- 🔲 `nx test proj-data-access` PASS — 4xx → `AppError` via interceptor (mock)
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
- 7 métodos expostos; nenhum usa `HttpClient` diretamente
- `deleteProjeto` existe como método mas nenhum componente o chama (verificado por lint boundary)

**Dependencies:**
- FE-PROJ-001 (MODULE_KEY para construção de URLs)
- INT-FE-PROJ-001 (ErrorNormalize interceptor ativo no escopo)

**Data impact:**
- Nenhum (FE não persiste; `deleteProjeto` delega ao BE)

**API / Contract impact:**
- Todos os 7 endpoints de `proj-service` (api-contract §4)

**Testing / Evidence required:**
- `HttpTestingController.expectOne('/api/proj/projetos')` passa para `listProjetos()`
- Teste de `deleteProjeto`: request DELETE emitido para URL correta; resposta 200 → `Observable<void>`

**Risks / Notes:**
- Se `proj-service` ainda não tiver o endpoint `POST .../reopen` deployado no ambiente de dev,
  usar `HttpClientTestingModule` + fixtures no teste; não bloquear a issue.
- `deleteProjeto` UI deferida: não expor affordance visual até que o fluxo LGPD cross-context
  (PROJ→IMP→COMP→PUB) esteja validado em staging.
