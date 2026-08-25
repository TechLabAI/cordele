# INT-PUB-001 -- ManuscriptContentPort adapter: wiring in-process com IMP

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

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

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/pub/integration/imp-manuscript-content.adapter.ts` — implementa `IManuscriptContentPort` do PUB; injeta `IMP_MANUSCRIPT_CONTENT_PORT` token (exported by ImpModule); delega `getContentTree(projetoId)` para o provider IMP; importa apenas a interface/token, nunca uma classe concreta de IMP
- [ ] `src/modules/pub/pub.module.ts` — condicional: se `ImpModule` disponível no bootstrap, usar `ImpManuscriptContentAdapter`; senão manter stub (controlado por `PUB_USE_STUBS`)
- [ ] `src/infrastructure/pub/integration/imp-manuscript-content.adapter.spec.ts` — unit tests com mock do provider IMP: `getContentTree` delega corretamente; retorna `null` quando IMP retorna `null`
- [ ] Documentar em `setup-local.md` a dependência do `ImpModule` no bootstrap do monólito

## Criterios de aceite
- [ ] `pnpm test src/infrastructure/pub/integration/imp-manuscript-content.adapter.spec.ts` exits 0
- [ ] Nenhum import direto de arquivo interno de IMP (somente token/interface do barrel de IMP)
- [ ] `PUB_USE_STUBS=true` mantém o stub sem erros de DI

## Dependencias
- PUB-012 (stub a substituir)
- PUB-003 (IManuscriptContentPort interface)
- INT-COMP-001 (ImpModule deve exportar seu ManuscriptContentPort)

## Estimativa
S

## Prioridade
P6
