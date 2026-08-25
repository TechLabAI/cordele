# SPEC-07 — Observability & Health

**Module:** COMP · **Refs:** `contracts/api-contract.md` §3, shared `adr/ADR-001-hexagonal-node.md`,
`ADR-002-modular-monolith.md`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir health checks, logging correlacionado, métricas mínimas e o comportamento de degradação quando a
leitura in-process do manuscrito (IMP) ou o `FileStoragePort` não estão disponíveis.

## Escopo

- **In:** health/readiness; `X-Correlation-Id` propagado; logs estruturados; métricas de upsert/upload/preview;
  degradação em dependências in-process/armazenamento.
- **Out:** APM externo; dashboards (plataforma). Sem broker/telemetria de eventos cross-process (POC).

## Decisões técnicas

- **Correlação:** todo request lê/gera `X-Correlation-Id`, ecoa na resposta e propaga a logs e eventos
  in-process (o `EmpresaContext` carrega `correlationId`/`empresa`/`principalId`).
- **Health:** readiness checa a conexão Prisma; o `FileStoragePort` (disk/S3) é checado como dependência
  de escrita da capa (degradável — o resto de COMP funciona sem capa).
- **Degradação (não falhar leitura):** se `ManuscriptContentPort` estiver indisponível, `preview-context`
  responde 409/erro explícito (não 500 silencioso); metadados/layout permanecem legíveis/graváveis.
- **Métricas:** contadores de `metadata_upsert`, `cover_upload` (+ rejeições 413/415), `layout_upsert`
  (+ rejeições 422 override), `preview_context` (+ overrides stale).

## Implementação

- Middleware de correlação + logger estruturado (JSON) com `correlationId`, `empresa`, `projetoId`, `route`.
- Endpoint de health do monólito agrega o readiness do módulo `comp` (DB + storage).
- Erros mapeados a RFC 7807 com `traceId` = `X-Correlation-Id`.

## Casos de borda

- IMP indisponível → `preview-context` 409/erro explícito; nunca 500 mudo.
- Storage indisponível → upload de capa falha explicitamente; metadados sem capa continua a funcionar.
- Request sem `X-Correlation-Id` → gerado e ecoado.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL echo X-Correlation-Id on every response and propagate it to logs and in-process events.`
- `THE SYSTEM SHALL expose a readiness check covering the Prisma connection and the cover FileStoragePort.`
- `IF ManuscriptContentPort is unavailable, THEN THE SYSTEM SHALL fail the preview explicitly (not a silent 500) while metadata and layout remain readable.`
- `THE SYSTEM SHALL emit counters for metadata upsert, cover upload (with 413/415 rejections), layout upsert (with 422 rejections) and preview assembly (with stale-override count).`
