## [FE-COMP-020] compStatusGuard — guard de status em_composicao (FE-only UX)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/access/src/lib/comp-status.guard.ts` implementa `compStatusGuard`: verifica que
o projeto referenciado pelo `:projetoId` está no status `em_composicao`. Um deep-link para
COMP com projeto em status diferente redireciona de volta ao PROJ. Guard FE-only (UX) — sem
equivalente de erro no BE (SPEC-07 §2).

**Context / Problem statement:**
- SPEC-01 §3: `compStatusGuard` é um **affordance de UX**, não uma boundary de segurança.
  O BE `comp-service` não rejeita escritas por status (api-contract §5 não tem illegal-status).
- O guard pré-empta deep-links para projetos em `rascunho`, `publicado` ou `com_erros`
  que acabariam em meio-estado confuso.
- Este guard é NOVO — não existe no shell (warning M3/M4).
- Depende do status do projeto ser acessível (via ProjetoStore do PROJ ou query lightweight).

**Approach (execution path):**
1. Criar `libs/comp/access/src/lib/comp-status.guard.ts` como CanActivateFn.
2. Extrair `projetoId` e verificar status via ProjetoStore (PROJ) ou chamada HTTP a proj-service
   (GET /api/proj/projetos/{id}/status — lightweight).
3. Se `status !== 'em_composicao'` → `router.createUrlTree(['/projetos'])`.
4. Se status não disponível → `true` (degradação: deixar o utilizador entrar; a UX de COMP
   não exibe affordances perigosas se o projeto não estiver em composição).
5. Exportar via `index.ts`.

**Non-goals:**
- Não é uma boundary de segurança (não substitui authGuard/accessGuard).
- Não chama comp-service.
- Não muda o status do projeto.

**Layer(s):**
frontend / libs/comp/access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§3)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:domain`
- CanActivateFn; pode importar `scope:proj` para ProjetoStore

**Implementation checklist (by file):**

**Lib: libs/comp/access**
- 🔲 `libs/comp/access/src/lib/comp-status.guard.ts`
- 🔲 `libs/comp/access/src/index.ts` (re-export atualizado)

**Tests**
- 🔲 `nx test comp-access` PASS
  - `status='rascunho'` → redireciona para /projetos
  - `status='em_composicao'` → passa
  - Status indisponível → `true` (degradação graceful)
- 🔲 `nx lint comp-access` PASS

**Milestone:**
Wave 4 / P5 Access guards

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P5

**Acceptance criteria:**
- `npx nx test comp-access` PASS
- `npx nx lint comp-access` PASS
- Projeto não em_composicao → redireciona para PROJ sem chamar comp-service
- Guard registrado nas rotas (FE-COMP-002)

**Dependencies:**
- FE-COMP-019 (executa antes do compStatusGuard na cadeia de guards)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Pode fazer GET lightweight a proj-service (não a comp-service)

**Testing / Evidence required:**
- Teste: status='publicado' → UrlTree para /projetos; status='em_composicao' → true

**Risks / Notes:**
- Se o ProjetoStore do PROJ não exportar o status pelo projetoId, optar por uma chamada HTTP a proj-service (`GET /api/proj/projetos/{id}`) — confirmar endpoint disponível antes de implementar.
- Este guard não é uma garantia de segurança; é UX de navegação.
