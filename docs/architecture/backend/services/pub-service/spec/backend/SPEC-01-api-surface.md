# SPEC-01 — API Surface

**Module:** PUB · **Refs:** `contracts/api-contract.md`, `adr/ADR-002-async-build-status-machine.md`,
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a superfície HTTP do `pub-service` sob `/api/pub`: disparo de exportação (assíncrono, `202`),
polling de status, histórico, download por URL assinada e KPIs — todos aninhados sob o projeto.

## Escopo

- **In:** os 5 endpoints REST (§4.1–§4.5 do api-contract), headers, auth/scopes, erros RFC 7807.
- **Out:** portas in-process (SPEC-10); montagem/validação (SPEC-02/03); modelo de dados (SPEC-04).

## Decisões técnicas

- Rotas aninhadas em `/api/pub/projetos/{projetoId}/publicacoes[...]` (house style PROJ/COMP).
- Disparo retorna `202` (novo build) ou `200` (build em voo — idempotente, D-R); polling retorna `200`
  com `Retry-After` enquanto não-terminal (D-N).
- Download nunca faz proxy de bytes — devolve URL assinada de TTL curto (D-F).

## Implementação

- `PubController` expõe: `POST publicacoes`, `GET publicacoes/{id}/status`, `GET publicacoes`,
  `GET publicacoes/{id}/download`, `GET publicacoes/stats`.
- Interceptor de correlação injeta/reflete `X-Correlation-Id`. `EmpresaContext` resolvido do JWT.
- DTOs de resposta: `PublicacaoStatus`, `PublicacaoHistoryItem[]`, `{arquivoUrl, expiresAt}`,
  `PublicationStats` (api-contract §6).

## Casos de borda

- Disparo em voo → `200` com o recurso existente (não erro).
- Polling de build terminal → `200` sem `Retry-After` (resposta cacheável).
- `projetoId`/`publicacaoId` de outra empresa → `404` (nunca revela existência cross-tenant).

## Critérios de aceite (EARS)

- `WHEN an authenticated editor triggers an export for an eligible project, THE SYSTEM SHALL respond 202
  with the PublicacaoStatus and a Location header.`
- `WHILE a build is non-terminal, THE SYSTEM SHALL respond to a status poll with 200 and a Retry-After
  header.`
- `WHEN a download is requested for a valido/avisos publication, THE SYSTEM SHALL return a signed URL and
  never proxy the bytes.`
- `IF a caller lacks the required scope, THEN THE SYSTEM SHALL respond 403 (urn:cordele:pub:forbidden).`
- `IF a projetoId or publicacaoId is not in the active empresa, THEN THE SYSTEM SHALL respond 404.`
