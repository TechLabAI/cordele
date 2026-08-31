# INT-PUB-001 -- ManuscriptContentPort adapter: wiring in-process com IMP

**Status:** DONE -- implementado 2026-08-29
**Maturidade:** 4 -- Completo
**Done/Total:** 4/4 itens

## Contexto

Substituir o stub `ManuscriptContentPort` (PUB-012) pelo adapter real que chama in-process o
provider de IMP (`IManuscriptContentPort` exportado pelo `ImpModule`). O adapter PUB injeta o
provider IMP por DI token, sem import direto de classes internas de IMP (hexagonal boundary —
ADR-001). A substituição deve ser transparente para `GeneratePublicationUseCase` e
`PublicationBuildJob`.

## Spec de referencia
- `contracts/integration-contracts.md` (§2.1 — ManuscriptContentPort from IMP)
- SPEC-10 (integrations §2.1)
- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`

## Escopo (IMPLEMENTADO 2026-08-29 — arquitetura real: microservicos via HTTP)

> Nota: INT-PUB-001 foi implementado como HTTP client (nao DI in-process) para refletir a
> arquitetura real de microservicos separados. Os paths abaixo diferem do escopo original.

Files created em `backend/services/pub-service/`:

- [x] `src/infrastructure/http/imp-manuscript-content.adapter.ts` — implementa `ManuscriptContentPort.getContentTree(projetoId, bearerToken)` via fetch nativo (Node 22); dois passos: GET /api/v1/imp/projetos/{id}/manuscritos → GET /api/v1/imp/manuscripts/{id}/estrutura; encaminha bearer token; retorna null em 404/vazio/erro de rede; extrai chapters do ContentTree do IMP.
- [x] `src/infrastructure/http/imp-manuscript-content.adapter.spec.ts` — 10 specs: happy path, 404, lista vazia, erro de rede, seleção do manuscrito mais recente, forwarding do Authorization header; todos passando.
- [x] `src/modules/pub/ports/manuscript-content.port.ts` — assinatura atualizada: `getContentTree(projetoId: string, bearerToken: string)`.
- [x] `src/app.module.ts` — binding condicional: `PUB_USE_STUBS !== true` → `ImpManuscriptContentAdapter`; stubs via `StubsModule` quando ativo.

## Criterios de aceite
- [x] `pnpm test src/infrastructure/http/imp-manuscript-content.adapter.spec.ts` exits 0 (10/10)
- [x] Bearer token encaminhado em `Authorization: Bearer` header para o IMP service
- [x] `PUB_USE_STUBS=true` mantém o stub sem erros de DI (httpAdapterProviders=[] nesse caso)
- [x] `pnpm exec tsc --noEmit` exits 0
- [x] `pnpm lint` exits 0

## Dependencias
- PUB-012 (stub a substituir)
- PUB-003 (IManuscriptContentPort interface)
- INT-COMP-001 (ImpModule deve exportar seu ManuscriptContentPort)

## Estimativa
S

## Prioridade
P6
