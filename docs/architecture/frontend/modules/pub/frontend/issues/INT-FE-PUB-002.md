## [INT-FE-PUB-002] Integração cross-context PROJ — getProjetoHeader (T08 header)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`PublicacaoApiService.getProjetoHeader(projetoId)` lê corretamente de `GET /api/proj/projetos/{projetoId}`
(PROJ-owned), retornando nome, chip de status e editora para o cabeçalho de T08.
Erro 404 em projeto inexistente/cross-tenant tratado via pub-error-map (urn:cordele:pub:projeto-not-found).

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §1`: T08 header (nomeProjeto, statusChip, editora) vem de PROJ.
- A decisão de se pub-service proxia este dado ou se o FE chama PROJ diretamente é de scaffold-time
  (doc 05 §2). A issue documenta a integração qualquer que seja a decisão.
- `backend-api-cross-link.md §6` GAP 3: confirmar base URL (pub-service proxy vs /api/proj direto).

**Approach (execution path):**
1. Em `getProjetoHeader()` de PublicacaoApiService: chamar /api/proj/projetos/{projetoId}.
2. Mapear campo `status` → statusChip legível (ex: "Publicado", "Com erros").
3. On 404: mapear para AppError `urn:cordele:pub:projeto-not-found`.

**Non-goals:**
- Não modifica o PROJ service ou seus contratos.

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub ↔ proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§1, §6 GAP 3)

**Milestone:**
Wave 4 / P4 Hub Integrations

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4

**Acceptance criteria:**
- getProjetoHeader retorna { nomeProjeto, statusChip, editora }
- 404 → AppError urn:cordele:pub:projeto-not-found

**Dependencies:**
- FE-PUB-007

**Risks / Notes:**
- Confirmar se o FE chama /api/proj diretamente ou via proxy em pub-service antes de codificar a URL base.
