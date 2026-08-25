# SPEC-01 — API Surface

**Module:** PROJ · **Refs:** `contracts/api-contract.md`, local `adr/ADR-001-service-boundary.md`,
shared `adr/ADR-001-hexagonal-node.md`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a superfície pública do `proj-service`: os recursos REST editor-facing (via BFF, base `/api/proj`)
e as portas inbound in-process que IMP/PUB/COMP chamam. Nenhum outro contexto lê `projeto_editorial`.

## Escopo

- **In:** REST create/list/detail/history/download-url/reopen/delete; portas inbound (§6.5 do api-contract).
- **Out:** parsing (IMP), metadados/layout (COMP), build/epubcheck de ePub (PUB).

## Decisões técnicas

- Superfície pública = portas exportadas + REST via BFF (local ADR-001). Sem endpoint REST para `advanceTo`
  (é porta in-process de IMP/PUB); `reopen` tem REST porque é ação do editor (api-contract §4.7).
- Erros RFC 7807 `application/problem+json`; `type` URN estável; `traceId` = `X-Correlation-Id`.

## Implementação

| Verbo / path | Use case | Scope |
|---|---|---|
| `POST /api/proj/projetos` | `CreateProjectUseCase` | `proj:write` |
| `GET /api/proj/projetos` | `ListProjectsUseCase` | `proj:read` |
| `GET /api/proj/projetos/{id}` | `GetProjectDetailUseCase` | `proj:read` |
| `GET /api/proj/projetos/{id}/publicacoes` | `GetPublicationHistoryUseCase` | `proj:read` |
| `GET /api/proj/projetos/{id}/publicacoes/{pid}/download` | `GetSignedDownloadUrlUseCase` | `proj:read` |
| `POST /api/proj/projetos/{id}/reopen` | `ReopenProjectForRevisionUseCase` | `proj:write` |
| `DELETE /api/proj/projetos/{id}` | `DeleteProjectUseCase` | `proj:delete` |

Portas inbound in-process: `CreateProjetoEditorialUseCase`, `ProjetoEditorialLookup`,
`AdvanceProjetoStatusUseCase`, `ReopenProjectForRevisionUseCase`.

## Casos de borda

- Token sem scope requerido → 403. Sem token → 401.
- `projetoId` de outra empresa → 404 (nunca revela existência cross-tenant).
- Porta de leitura cross-context indisponível → degrada (`degraded=true`), nunca 500 na listagem/detalhe.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL expose the editor-facing surface only under /api/proj through the BFF.`
- `THE SYSTEM SHALL expose advanceTo exclusively as an in-process inbound port, never as an HTTP endpoint.`
- `IF a request lacks the required scope, THEN THE SYSTEM SHALL respond 403 (urn:cordele:proj:forbidden).`
- `IF a referenced project belongs to another empresa, THEN THE SYSTEM SHALL respond 404.`
