# INT-PUB-005 -- PublicationErasurePort: registro DI em ProjModule (LGPD cascade step 1)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

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

- [ ] `src/modules/proj/proj.module.ts` — garantir `PubModule` nos `imports` (se INT-PUB-004 já incluiu, é no-op); injetar `PUBLICATION_ERASURE_PORT` token no use case de deleção de projeto
- [ ] `src/modules/proj/application/delete-project.use-case.ts` — (ou equivalente) acrescentar chamada a `PublicationErasurePort.purge(projetoId)` antes de `projetoRepository.delete(projetoId)`; se `purge` lança, abortar deleção e propagar erro (LGPD não pode ser parcial)
- [ ] `src/modules/proj/integration/pub-erasure.adapter.spec.ts` — unit test: `delete-project` chama `purge` antes de deletar o projeto; se `purge` lança, `delete` não prossegue

## Criterios de aceite
- [ ] `pnpm test src/modules/proj/integration/pub-erasure.adapter.spec.ts` exits 0
- [ ] `purge` chamado antes de `projetoRepository.delete` (ordem verificada no mock)
- [ ] Falha em `purge` impede deleção do projeto (LGPD-safe)

## Dependencias
- PUB-015 (PublicationErasurePort implementado + token exportado)
- INT-PUB-004 (PubModule já importado em ProjModule)

## Estimativa
S

## Prioridade
P6
