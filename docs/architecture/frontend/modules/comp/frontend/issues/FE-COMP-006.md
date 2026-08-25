## [FE-COMP-006] MetadadosApiService — GET/PUT metadados, POST/DELETE capa

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/data-access/src/lib/metadados-api.service.ts` implementa as 4 operações HTTP de
Metadados: `getMetadados(id)`, `upsertMetadados(id, body)`, `uploadCapa(id, file)` e
`removeCapa(id)`. Nunca toca em `HttpClient` diretamente — usa `@cordele/shared/access-http-base`.
DTOs mapeiam os schemas de api-contract §6.1/§4.3/§4.4.

**Context / Problem statement:**
- SPEC-04 §1 (tabela de recursos) e contracts/backend-api-cross-link.md §1 especificam os
  4 endpoints de Metadados.
- `GET .../metadados` retorna `Metadados` com `materialized:false` se nunca salvo (D-M).
- `PUT .../metadados` é idempotente (upsert); retorna `200 Metadados` ou `400 validation`.
- `POST .../capa` aceita multipart `image/jpeg|png|webp` ≤ 10 MB → `201 { capaUrl }`;
  erros: `413 cover-too-large`, `415 unsupported-cover-format`.
- `DELETE .../capa` limpa `capaUrl`; idempotente (`204`).
- Bloqueia: FE-COMP-008 (MetadataFacade)

**Approach (execution path):**
1. Criar `MetadadosApiService` com `@Injectable({ providedIn: 'root' })`.
2. Injetar `HttpClient` via `@cordele/shared/access-http-base` (nunca HttpClient diretamente).
3. Implementar `getMetadados(projetoId: string): Observable<MetadadosDto>`.
4. Implementar `upsertMetadados(projetoId, body: UpsertMetadadosDto): Observable<MetadadosDto>`.
5. Implementar `uploadCapa(projetoId, file: File): Observable<{ capaUrl: string }>` (FormData multipart).
6. Implementar `removeCapa(projetoId): Observable<void>`.
7. Definir DTOs inline ou em `metadados.dto.ts`.

**Non-goals:**
- Não implementa a Facade (FE-COMP-008).
- Não faz mapeamento de erro (responsabilidade do interceptor `ErrorNormalize`).
- Não persiste cache (SPEC-04 §1: re-fetch sempre).

**Layer(s):**
frontend / libs/comp/data-access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §3)
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:data-access`
- Componentes nunca injetam `MetadadosApiService` diretamente — só as facades

**Implementation checklist (by file):**

**Lib: libs/comp/data-access**
- 🔲 `libs/comp/data-access/src/lib/metadados-api.service.ts`
- 🔲 `libs/comp/data-access/src/lib/metadados.dto.ts`
- 🔲 `libs/comp/data-access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test comp-data-access` PASS (HttpTestingController: GET/PUT/POST/DELETE corretos)
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
- `npx nx lint comp-data-access` PASS
- `uploadCapa` envia `Content-Type: multipart/form-data`
- `removeCapa` retorna Observable<void> (HTTP 204)

**Dependencies:**
- FE-COMP-001 (MODULE_KEY para path construction)
- INT-FE-COMP-001 (interceptors de acesso-http-base ativos)

**Data impact:**
- Nenhum no FE

**API / Contract impact:**
- Consome `/api/comp/projetos/{projetoId}/metadados` (GET/PUT) e `/api/comp/projetos/{projetoId}/capa` (POST/DELETE)

**Testing / Evidence required:**
- Testes com `HttpTestingController`; verificar URL, método e body de cada operação

**Risks / Notes:**
- Garantir que o `FormData` de upload inclui o campo correto (verificar com api-contract §4.3 antes de implementar).
- `413` e `415` chegam como `ProblemDetail` e são convertidos pelo `ErrorNormalize` interceptor — o service não precisa tratá-los diretamente.
