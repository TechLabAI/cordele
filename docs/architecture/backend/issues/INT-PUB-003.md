# INT-PUB-003 -- ProjectStatusPort adapter: HTTP client em pub-service chamando PROJ.advance-status

> **REVISADO 2026-08-28: adapter e HTTP client (nao DI in-process) -- arquitetura real e microservicos separados, nao monolito.**

**Status:** DONE -- implementado 2026-08-29
**Maturidade:** 4 -- Completo
**Done/Total:** 4/4 itens

## Contexto

Implementar o adapter `ProjProjectStatusAdapter` que implementa `IProjectStatusPort`
chamando **via HTTP** o endpoint `POST /api/v1/proj/projetos/:projetoId/advance-status`
exposto pelo `proj-service`. O caller (pub-service) propaga o JWT original do usuario
(`Authorization: Bearer <token>`) conforme RULE-06 (outbound HTTP clients somente em
`infrastructure/http`). Falha HTTP (4xx/5xx ou rede) deve ser capturada e surfaceada como
`ProjectStatusAdvanceError` sem perder o desfecho do build (SPEC-02 §casos de borda).

O endpoint PROJ foi implementado em 2026-08-28:
- **Path:** `POST /api/v1/proj/projetos/:projetoId/advance-status`
- **Auth:** `JwtAuthGuard` padrao do proj-service (`Authorization: Bearer <token>` repassado pelo PUB)
- **Body:** `{ "targetStatus": "publicado" | "com_erros" | "em_composicao" | "rascunho" }` (enum `ProjetoStatus`)
- **Resposta 200:** `{ "projetoId": "...", "newStatus": "...", "changed": true|false }`
- **Resposta 409:** transicao ilegal (`IllegalStatusTransitionError`) — `{ type: "urn:cordele:proj:illegal-status-transition", from, to }`
- **Resposta 404:** projeto nao encontrado nesta empresa

## Spec de referencia
- `contracts/integration-contracts.md` (§2.4 — ProjectStatusPort, D-P)
- SPEC-02 (build-orchestration §casos de borda — falha de advanceTo)
- SPEC-10 (integrations §2.3)

## Escopo (IMPLEMENTADO 2026-08-29)

Files created em `backend/services/pub-service/`:

- [x] Endpoint em `proj-service`: `POST /api/v1/proj/projetos/:projetoId/advance-status` (implementado 2026-08-28 em `proj.controller.ts`)
- [x] `src/infrastructure/http/proj-project-status.adapter.ts` — implementa `AdvanceProjetoStatusPort.advanceTo(input, bearerToken)` via fetch nativo (Node 22); POST com `Authorization: Bearer <token>`; captura erros HTTP/rede; lanca `ProjectStatusAdvanceError`
- [x] `src/infrastructure/http/proj-project-status.adapter.spec.ts` — 9 specs: happy path, changed=false, 409→error, 404→error, rede→error, 5xx→error, no reopen, config URL; todos passando
- [x] `src/domain/pub/errors/project-status-advance.error.ts` — classe `ProjectStatusAdvanceError` com `projetoId`, `targetStatus` (local type `ProjetoTargetStatusDomain`), `reason`; zero imports modules/ (RULE-01/02)
- [x] `src/modules/pub/ports/advance-projeto-status.port.ts` — assinatura atualizada: `advanceTo(input, bearerToken: string)`; stubs e todos os callers atualizados

## Criterios de aceite
- [x] `pnpm test src/infrastructure/http/proj-project-status.adapter.spec.ts` exits 0 (9/9)
- [x] Bearer token do request original e repassado no header `Authorization` para o proj-service
- [x] Falha de `advanceTo` nao reverte o `Publicacao` persistido (log + sem relancamento no job)
- [x] PUB nunca chama `reopen` (sem metodo `reopen` no `AdvanceProjetoStatusPort`)
- [x] `pnpm exec tsc --noEmit` exits 0
- [x] `pnpm lint` exits 0

## Dependencias
- PUB-004 (IProjectStatusPort interface, PublicationBuildJob)
- proj-service rodando e acessivel via `PROJ_SERVICE_BASE_URL` (env var)

## Estimativa
S

## Prioridade
P6
