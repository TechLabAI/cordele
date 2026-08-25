# SPEC-06 — Security

**Module:** COMP · **Refs:** `contracts/api-contract.md` §2, §4.3, shared `adr/ADR-003-multi-tenancy.md`,
local `adr/ADR-003-cover-binary-storage-port.md`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir autenticação, autorização por scope, isolamento multi-tenant, e a segurança do upload de capa
(validação de tipo/tamanho, LGPD sobre metadados/capa).

## Escopo

- **In:** OAuth2 Bearer JWT; scopes `comp:read`/`comp:write`; tenant via claim + `EmpresaContext`
  (RULE-07); validação de upload (jpeg/png/webp ≤ 10 MB); confidencialidade LGPD (tenant-scope).
- **Out:** emissão de tokens (IdP); mTLS/assinatura (não aplicável ao POC); erasure orchestration (PROJ).

## Decisões técnicas

- **Tenant só do claim:** a `empresa` vem do JWT e aplica-se via `EmpresaContext`; nunca de path/query/body,
  inclusive nas portas in-process (herdam o contexto do chamador). `projetoId` de outra empresa → 404.
- **Scopes mínimos:** leitura (`comp:read`) para get/preview; escrita (`comp:write`) para upsert/capa.
- **Upload seguro (D-L):** valida `contentType ∈ {image/jpeg,image/png,image/webp}` e `size ≤ 10 MB` **antes**
  de gravar; recomenda-se checagem de magic bytes além do content-type declarado. Sem execução do binário.
- **LGPD:** metadados (nome do autor, capa) são ativos criativos não publicados; todo acesso é tenant-scoped;
  a erasure apaga linhas + binário da capa via `CompositionErasurePort` (SPEC-10).

## Implementação

- Guard OAuth2 valida JWT (`OAUTH2_JWK_SET_URI`) e scope por rota.
- Interceptor de tenancy popula `EmpresaContext`; o adapter Prisma alveja a schema resolvida.
- `UploadCoverUseCase` valida tipo/tamanho no boundary da aplicação (não no controller apenas).

## Casos de borda

- Sem token → 401; token sem scope → 403.
- `projetoId` de outra empresa → 404 (nunca revela existência cross-tenant).
- Upload com content-type falsificado (magic bytes divergem) → 415.
- Capa 0 bytes ou > 10 MB → rejeitada (400/413).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's empresa claim.`
- `IF a request is unauthenticated, THEN THE SYSTEM SHALL respond 401; IF it lacks the required scope, THEN 403.`
- `IF a caller references a projetoId of another empresa, THEN THE SYSTEM SHALL respond 404.`
- `THE SYSTEM SHALL validate cover media type (jpeg/png/webp) and size (≤ 10 MB) before storing any bytes.`
- `THE SYSTEM SHALL keep metadata and cover access tenant-scoped and support LGPD erasure of rows and the cover binary.`
