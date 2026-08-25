# SPEC-06 — Security

**Module:** PUB · **Refs:** `contracts/api-contract.md` §2/§4.4, shared `ADR-003-multi-tenancy.md`,
`docs/architecture/backend/standards/rbac.md`.

## Objetivo

Especificar auth/authorization (OAuth2 + scopes), isolamento multi-tenant, confidencialidade do artefato e
a URL de download assinada de TTL curto.

## Escopo

- **In:** validação JWT; scopes `pub:read`/`pub:write`; `EmpresaContext` (schema-per-tenant); URL assinada;
  confidencialidade do `.epub`.
- **Out:** identity provider (externo); LGPD erasure (SPEC-10 / PROJ cascade).

## Decisões técnicas

- **Auth:** OAuth2 Bearer JWT; sem token → `401`. Scope insuficiente → `403`.
- **Scopes:** `pub:write` (disparar export), `pub:read` (status, histórico, stats, download-url).
- **Tenancy:** `empresa` resolvida **exclusivamente** do claim do JWT (`EmpresaContext`, RULE-07); nunca de
  path/query/body — inclusive nas portas in-process (`PublicationHistoryPort`/`PublicationErasurePort`
  herdam o `EmpresaContext` do chamador). O job roda no `EmpresaContext` do disparo.
- **Download (D-F):** `FileStoragePort.signUrl(key, ttl)` gera URL assinada de TTL curto
  (`PUB_DOWNLOAD_URL_TTL_SECONDS`); bytes servidos pelo storage, nunca pelo app.
- **Confidencialidade:** artefatos `.epub` sob chaves tenant-scoped (`emp_<slug>/publicacoes/<id>/...`);
  nunca expostos exceto pela URL assinada.

## Implementação

- Guard OAuth2 no `PubController`; validação via `OAUTH2_JWK_SET_URI`.
- Todas as queries Prisma resolvem o schema por `EmpresaContext`; um `projetoId`/`publicacaoId` de outra
  empresa retorna `404` (nunca revela existência cross-tenant).
- Download só para `epubcheckStatus ∈ {valido, avisos}`; caso contrário `409 artifact-not-available`.

## Casos de borda

- URL assinada expirada → cliente re-solicita `GET .../download` (re-mint idempotente, novo TTL).
- Token válido, scope errado (`pub:read` tentando disparar) → `403`.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's empresa claim.`
- `IF a caller references a projetoId/publicacaoId of another empresa, THEN THE SYSTEM SHALL respond 404.`
- `THE SYSTEM SHALL require pub:write to trigger an export and pub:read for status/history/stats/download.`
- `WHEN a download is requested for a valido/avisos publication, THE SYSTEM SHALL return a short-TTL signed
  URL and never proxy the bytes.`
- `THE SYSTEM SHALL store .epub artifacts under tenant-scoped keys, never exposed except via a signed URL.`
