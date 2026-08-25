## [INT-FE-PROJ-002] Integração @cordele/shared/empresa-context — authGuard + empresaGuard

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
As rotas PROJ consomem corretamente `authGuard` e `empresaGuard` de `@cordele/shared`.
`empresaGuard` garante empresa ativa antes de entrar em qualquer tela PROJ; troca de empresa
aciona re-fetch via `LibraryFacade` (via sinal compartilhado). Tenancy é JWT-based (não header).

**Context / Problem statement:**
- SPEC-01 §3 lista os 4 guards; `authGuard` e `empresaGuard` são shared.
- ADR-PROJ-001 e api-contract §2: tenancy vem do JWT claim `empresa`, não de path/body param.
  O FE garante empresa ativa via `empresaGuard` mas não passa `X-Empresa-Id` como scoping authority.
- `LibraryFacade` deve observar a empresa ativa e cancelar/re-emitir o request na troca.
- Este comportamento é testado no cenário Gherkin `proj-empresa-switch` (e2e T02).

**Approach (execution path):**
1. Verificar que `authGuard` de `@cordele/shared/auth-session` e `empresaGuard` de
   `@cordele/shared/empresa-context` são importados corretamente em `proj.routes.ts`.
2. Em `LibraryFacade.load()`: injetar `EmpresaContextService` (ou signal) e usar `switchMap`
   para cancelar e re-emitir o request quando a empresa muda.
3. Testar o cenário de troca de empresa com mock de `EmpresaContextService`.

**Non-goals:**
- Não implementa `authGuard` nem `empresaGuard` (responsabilidade de `@cordele/shared`).

**Layer(s):**
frontend / libs/proj/data-access + libs/proj/feature-library

**Bounded context:**
proj (cross-cutting integration)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§3)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2 — empresa-switch)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `LibraryFacade` — observar `EmpresaContextService` signal; `switchMap` na troca

**Lib: libs/proj/shell-entry**
- 🔲 `proj.routes.ts` — guards importados de `@cordele/shared/*`

**Tests**
- 🔲 `nx test proj-data-access` PASS — empresa troca → request anterior cancelado + novo load
- 🔲 `nx lint proj-shell-entry` PASS

**Milestone:**
Wave 2 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- Troca de empresa → cancelamento + re-fetch confirmado por teste
- Guards compartilhados não duplicados em `libs/proj`

**Dependencies:**
- FE-PROJ-002 (routes)
- FE-PROJ-009 (LibraryFacade)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Re-emissão de `GET /api/proj/projetos` na troca de empresa

**Testing / Evidence required:**
- Spy em `EmpresaContextService`; verificar que request anterior é cancelado (não chega ao interceptor)

**Risks / Notes:**
- Se `EmpresaContextService` não expuser um signal observável, usar `distinctUntilChanged()` no
  observable; padrão de cancelamento via `switchMap` é obrigatório (não `mergeMap`).
