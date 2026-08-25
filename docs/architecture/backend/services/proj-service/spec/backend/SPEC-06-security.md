# SPEC-06 — Security (OAuth2, tenancy, signed download, LGPD)

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §2, §4.5–4.6, shared `adr/ADR-003-multi-tenancy.md`,
local `adr/ADR-002`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Especificar autenticação/autorização, isolamento de tenant, o download por URL assinada (a SPA nunca faz
proxy dos bytes) e as garantias de segurança da erasure LGPD.

## Escopo

- **In:** OAuth2 Bearer + scopes; `EmpresaContext`/RULE-07; URL assinada de download (D-F); privilégio de
  erasure; confidencialidade.
- **Out:** emissão do token (IdP externo); assinatura do artefacto em si (PUB `FileStoragePort`).

## Decisões técnicas

- **Scopes:** `proj:read` (list/detail/history/download-url), `proj:write` (create/reopen),
  `proj:delete` (erasure LGPD — privilegiado, separado do write comum).
- **Tenant só do JWT:** `empresa` vem do claim, aplicado via `EmpresaContext`; nunca de path/query/body,
  inclusive no porta in-process `advanceTo` (herda o contexto do chamador).
- **Download (D-F):** `GET .../download` devolve URL assinada de curto TTL mintada por PUB; **PROJ nunca
  transmite os bytes**. Só publicações `valido|avisos` têm artefacto; `erros_criticos|pendente` → 409.
- **Erasure:** privilégio `proj:delete`; purga tenant-scoped; emite `ProjectDeleted` só após sucesso.

## Implementação

- Guarda de scope por endpoint (tabela SPEC-01). Sem token → 401; scope em falta → 403.
- `EmpresaContext` resolve o schema do tenant; qualquer `projetoId`/`publicacaoId` de outra empresa → 404.
- URL assinada: TTL curto (ex.: minutos), single-use quando o storage suportar; o cliente abre a URL
  diretamente contra o object storage.

## Casos de borda

- Download de publicação `erros_criticos` → 409 `urn:cordele:proj:artifact-not-available`.
- `publicacaoId` não pertence ao `projetoId`/empresa → 404.
- Chamada de `DELETE` sem `proj:delete` → 403.
- URL assinada expirada → o cliente re-solicita via §4.5 (nova mintagem), sem proxy.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's empresa claim.`
- `IF a caller references a projetoId or publicacaoId of another empresa, THEN THE SYSTEM SHALL respond 404.`
- `WHEN a download is requested for a valido/avisos publication, THE SYSTEM SHALL return a short-TTL signed
  URL and never proxy the artifact bytes.`
- `IF the publication is erros_criticos or pendente, THEN THE SYSTEM SHALL respond 409.`
- `IF a caller lacks proj:delete, THEN THE SYSTEM SHALL respond 403 on DELETE.`
- `THE SYSTEM SHALL scope every read and every erasure to the active empresa.`
