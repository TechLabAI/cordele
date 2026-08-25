## [INT-FE-COMP-003] Integração guards COMP ↔ PROJ — compStatusGuard com status do projeto

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`compStatusGuard` (FE-COMP-020) obtém o status do projeto a partir do PROJ (ProjetoStore ou
endpoint proj-service) e redireciona para PROJ quando não é `em_composicao`. O handoff
PROJ → COMP → PUB carrega `projetoId` corretamente em cada transição de rota.

**Context / Problem statement:**
- `compStatusGuard` precisa de uma fonte de status do projeto; pode ser:
  1. `ProjetoStore` do módulo PROJ (se exportado em `@cordele/proj`) — preferência.
  2. GET lightweight a `proj-service` (`GET /api/proj/projetos/{id}`) — fallback.
- O handoff IMP → COMP (após importação confirmada) e PROJ → COMP (reopen) deve funcionar
  com o `projetoId` correto na rota.

**Approach (execution path):**
1. Verificar se `@cordele/proj` exporta um `ProjetoStatusService` ou equivalente.
2. Se sim: injetar em `compStatusGuard` via `scope:proj` (boundary permitida de `scope:comp type:domain`).
3. Se não: fazer GET a `/api/proj/projetos/{id}` para ler o status (single HTTP call).
4. Testar handoff: navegar de PROJ "Abrir" → COMP; navegar de IMP confirm → COMP.
5. Testar redirect: projeto com status `publicado` → redireciona para /projetos.

**Non-goals:**
- Não modifica ProjetoStore (se existir); só lê.
- Não altera o fluxo de status do PROJ.

**Layer(s):**
frontend / libs/comp/access (integração com libs/proj ou proj-service)

**Bounded context:**
comp ↔ proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§2 nav transitions, §3 guards)

**Milestone:**
Wave 4 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- Handoff PROJ → COMP funciona com projetoId correto
- Projeto `publicado` → redirect para /projetos sem abrir COMP
- Handoff COMP → PUB via "Exportar" funciona com projetoId correto

**Dependencies:**
- FE-COMP-019 (compProjetoGuard), FE-COMP-020 (compStatusGuard)

**Risks / Notes:**
- Se `scope:proj` não expõe o status do projeto, usar GET a proj-service como fallback; evitar acoplamento direto a internos do PROJ.
