# INT-PUB-005 -- PublicationErasurePort: registro DI em ProjModule (LGPD cascade step 1)

**Status:** REDUCED -- pos-validacao 2026-09-03
**Maturidade:** 13 -- Inicial
**Done/Total:** 2/6 itens

## Contexto

Registrar o `PublicationErasurePort` (PUB-015) como provider injetável no `ProjModule`, ativando
o cascade LGPD step 1 (PUB purge → depois PROJ deleta `projeto_editorial`). Integration-contracts §1.2
/ proj integration-contracts §3. O `PubModule` exporta o token; `ProjDeleteProjectUseCase`
(ou equivalente) injeta e chama `purge(projetoId)` antes de deletar o projeto.

## Spec de referencia
- `contracts/integration-contracts.md` (§1.2 — PublicationErasurePort, LGPD cascade step 1)
- SPEC-04 (data-model §5 — data lifecycle e LGPD)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/modules/proj/proj.module.ts` (proj-service) — `PUBLICATION_ERASURE_PORT` fornecido globalmente via `ErasurePortsModule (@Global())` importado em `AppModule`; padrão HTTP adapter para microserviços; verificado P12
- [x] `src/modules/proj/use-cases/delete-projeto.use-case.ts` — (nome real difere: `delete-projeto` em vez de `delete-project`); chama `PublicationErasurePort.erase(projetoId)` antes de deletar projeto; se erase lança, aborta deleção; verificado P12
- [x] `src/infrastructure/proj/erasure/pub-publication-erasure.adapter.spec.ts` — (path real difere: `infrastructure/proj/erasure/`); spec do adapter HTTP; verificado P12

## Criterios de aceite
- [x] `pnpm test src/infrastructure/proj/erasure/pub-publication-erasure.adapter.spec.ts` exits 0 (passes no path real)
- [x] `erase` chamado antes de `projetoRepository.delete` (ordem verificada) — verificado no `delete-projeto.use-case.ts`
- [x] Falha em `erase` impede deleção do projeto — verificado no código: erro propagado sem try/catch no use case

## Dependencias
- PUB-015 (PublicationErasurePort implementado + token exportado)
- INT-PUB-004 (PubModule já importado em ProjModule)

## Estimativa
S

## Prioridade
P6
