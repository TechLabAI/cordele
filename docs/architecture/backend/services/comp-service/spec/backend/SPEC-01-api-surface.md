# SPEC-01 — API Surface

**Module:** COMP · **Refs:** `contracts/api-contract.md`, local `adr/ADR-001-service-boundary.md`,
shared `adr/ADR-001-hexagonal-node.md`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a superfície pública do `comp-service`: os recursos REST editor-facing (via BFF, base `/api/comp`,
rotas aninhadas em `/projetos/{projetoId}/...` — D-J) e as portas inbound in-process que PUB e PROJ chamam.
Nenhum outro contexto lê `metadados` / `configuracao_layout` diretamente.

## Escopo

- **In:** REST get/upsert de metadados, upload/remoção de capa, get/upsert de layout, preview-context;
  portas inbound (§6.5 do api-contract).
- **Out:** parsing/conteúdo (IMP); status/lifecycle (PROJ); build/epubcheck/download de ePub (PUB).

## Decisões técnicas

- Superfície pública = portas exportadas + REST via BFF (local ADR-001). Sem endpoint REST para
  `GetMetadados`/`GetConfiguracaoLayout` (são portas in-process de PUB).
- Rotas aninhadas por projeto (D-J): cada agregado é singleton 1:1 com o projeto; não há coleção
  cross-project a listar.
- Erros RFC 7807 `application/problem+json`; `type` URN estável; `traceId` = `X-Correlation-Id`.

## Implementação

| Verbo / path | Use case | Scope |
|---|---|---|
| `GET /api/comp/projetos/{id}/metadados` | `GetMetadadosViewUseCase` | `comp:read` |
| `PUT /api/comp/projetos/{id}/metadados` | `UpdateMetadadosUseCase` | `comp:write` |
| `POST /api/comp/projetos/{id}/capa` | `UploadCoverUseCase` | `comp:write` |
| `DELETE /api/comp/projetos/{id}/capa` | `RemoveCoverUseCase` | `comp:write` |
| `GET /api/comp/projetos/{id}/layout` | `GetLayoutViewUseCase` | `comp:read` |
| `PUT /api/comp/projetos/{id}/layout` | `UpdateLayoutUseCase` | `comp:write` |
| `GET /api/comp/projetos/{id}/preview-context` | `GetLayoutPreviewUseCase` | `comp:read` |

Portas inbound in-process (não REST): `GetMetadadosUseCase`, `GetConfiguracaoLayoutUseCase`,
`ProjectMetadataPort`, `CompositionErasurePort` (§6.5 do api-contract).

## Casos de borda

- Token sem scope requerido → 403. Sem token → 401.
- `projetoId` de outra empresa → 404 (nunca revela existência cross-tenant).
- `GET` de agregado ainda não materializado → 200 com representação default (`materialized=false`), não 404 (D-M).
- `preview-context` sem manuscrito importado → 409 (`urn:cordele:comp:manuscript-missing`).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL expose the editor-facing surface only under /api/comp through the BFF, nested under /projetos/{projetoId}.`
- `THE SYSTEM SHALL expose GetMetadados and GetConfiguracaoLayout exclusively as in-process inbound ports, never as HTTP endpoints.`
- `IF a request lacks the required scope, THEN THE SYSTEM SHALL respond 403 (urn:cordele:comp:forbidden).`
- `IF a referenced project belongs to another empresa, THEN THE SYSTEM SHALL respond 404.`
- `WHEN a GET targets an aggregate not yet materialized, THE SYSTEM SHALL return a default representation with materialized=false, not 404.`
