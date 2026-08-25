# INT-PUB-003 -- ProjectStatusPort adapter: wiring in-process com PROJ.advanceTo

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implementar o adapter `ProjProjectStatusAdapter` que implementa `IProjectStatusPort`
chamando in-process `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` do `ProjModule`.
Injeção por token de DI (ADR-001). Falha em `advanceTo` (transição ilegal ou PROJ indisponível)
deve ser capturada e surfaceada como `502 status-advance-failed` sem perder o desfecho do build
(SPEC-02 §casos de borda).

## Spec de referencia
- `contracts/integration-contracts.md` (§2.4 — ProjectStatusPort, D-P)
- SPEC-02 (build-orchestration §casos de borda — falha de advanceTo)
- SPEC-10 (integrations §2.3)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/pub/integration/proj-project-status.adapter.ts` — implementa `IProjectStatusPort`; injeta `PROJ_ADVANCE_STATUS_USE_CASE` token; `advanceTo({ projetoId, targetStatus })` chama o use case PROJ e captura exceções; lança `ProjectStatusAdvanceError` (não propaga a exceção interna de PROJ) para que `PublicationBuildJob` registre `status-advance-failed`
- [ ] `src/infrastructure/pub/integration/proj-project-status.adapter.spec.ts` — unit tests: `advanceTo(publicado)` → delegado corretamente; `advanceTo` lança → `ProjectStatusAdvanceError` propagado (build result não revertido); PUB nunca chama `reopen` (verificado: nenhuma chamada de reopen nos mocks)
- [ ] `src/domain/pub/errors/project-status-advance.error.ts` — classe `ProjectStatusAdvanceError` com `projetoId`, `targetStatus`, `reason`
- [ ] Adicionar stub do `IProjectStatusPort` no `stubs.module.ts` de PUB-012: `advanceTo` echo (retorna success); configurável para lançar via env `PUB_PROJ_STUB_FAIL=true`

## Criterios de aceite
- [ ] `pnpm test src/infrastructure/pub/integration/proj-project-status.adapter.spec.ts` exits 0
- [ ] Falha de `advanceTo` não reverte o `Publicacao` persistido (testado: `save` chamado antes do `advanceTo`)
- [ ] PUB nunca chama `reopen` (sem método `reopen` no `IProjectStatusPort`)

## Dependencias
- PUB-004 (IProjectStatusPort interface, PublicationBuildJob)
- PROJ: `PROJ_ADVANCE_STATUS_USE_CASE` token exportado pelo ProjModule

## Estimativa
S

## Prioridade
P6
