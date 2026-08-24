## [FE-IMP-007] ManuscriptApiService — upload multipart com progress

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/data-access/src/lib/services/manuscript-api.service.ts` expõe `upload()` retornando
`Observable<HttpEvent<ManuscritoDetail>>` com `reportProgress: true` e `observe: 'events'`.
Dois modos de binding (projetoTitulo | projetoId) são mutuamente exclusivos. Timeout configurável.

**Context / Problem statement:**
- SPEC-04 §2 e `backend-api-cross-link.md §1` definem o upload como a operação central do módulo.
- `POST /api/imp/manuscripts` usa `multipart/form-data` — `file` + exatamente um de `projetoTitulo`
  ou `projetoId` (D-C project binding).
- Nunca usa `HttpClient` direto em componentes — apenas via serviço.
- Timeout de `~120 s` via token `IMP_UPLOAD_TIMEOUT_MS`.
- Bloqueia: FE-IMP-010 (ImportFacade)

**Approach (execution path):**
1. Criar `ManuscriptApiService` injetável em `libs/imp/data-access` com `inject(HttpClient)`.
2. Implementar `upload(input: { file: File; projetoTitulo?: string; projetoId?: string }):
   Observable<HttpEvent<ManuscritoDetail>>`.
3. Construir `FormData` com `file` + exatamente um binding; emitir erro local se nenhum ou ambos.
4. Usar `this.http.post<ManuscritoDetail>(url, formData, { observe: 'events', reportProgress: true })`.
5. Aplicar `timeout(IMP_UPLOAD_TIMEOUT_MS)` via `rxjs/operators`.
6. Interceptors de `@cordele/shared/access-http-base` são aplicados automaticamente — não duplicar.

**Non-goals:**
- Não implementa `getById`, `getEstrutura`, `listByProjeto` (FE-IMP-008).
- Não implementa endpoints do addendum (FE-IMP-009).
- Não implementa `ImportFacade` (FE-IMP-010).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §2)
- `docs/architecture/frontend/modules/imp/frontend/contracts/backend-api-cross-link.md` (§1, §2)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`
- Depende de `@cordele/shared/access-http-base` — nunca injeta `HttpClient` em componentes

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/services/manuscript-api.service.ts` (método upload)
- 🔲 `libs/imp/data-access/src/lib/tokens/imp-upload-timeout.token.ts` (IMP_UPLOAD_TIMEOUT_MS)
- 🔲 `libs/imp/data-access/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-data-access` PASS (upload envia FormData com exatamente um binding; rejeita ambos;
  HttpTestingController verifica endpoint)
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
- Upload com ambos `projetoTitulo` e `projetoId` lança erro local (sem request)
- Upload com nenhum lança erro local
- `reportProgress: true` configurado no request

**Dependencies:**
- FE-IMP-006 (DTOs — ManuscritoDetail)

**Data impact:**
- Nenhum client-side

**API / Contract impact:**
- `POST /api/imp/manuscripts` (api-contract §4.1)

**Testing / Evidence required:**
- `HttpTestingController.expectOne('/api/imp/manuscripts')` com método POST
- Teste de timeout via `fakeAsync` + `tick(IMP_UPLOAD_TIMEOUT_MS + 1)`

**Risks / Notes:**
- Confirmar se `@cordele/shared/access-http-base` já injeta `X-Empresa-Id` e `X-Correlation-Id`
  automaticamente (não adicionar manualmente).
