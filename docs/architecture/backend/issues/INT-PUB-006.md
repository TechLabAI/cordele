# INT-PUB-006 -- EmpresaContext propagation para o build job assíncrono (multi-tenant isolation)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

O `PublicationBuildJob` roda assincronamente (após o return do request handler) e precisa do
`EmpresaContext` do request original para que as queries Prisma escolham o schema correto durante
montagem/validação/persistência. `AsyncLocalStorage` perde o contexto ao sair do callstack
síncrono do request — o job deve capturar o slug antes do `return 202` e restaurá-lo
explicitamente via `EmpresaContext.run(slug, async () => { await job.run() })`.

## Spec de referencia
- SPEC-06 (security — EmpresaContext RULE-07, job roda no EmpresaContext do disparo)
- SPEC-02 (build-orchestration — job roda sem bloquear thread do request)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/pub/application/generate-publication.use-case.ts` — capturar `EmpresaContext.getSlug()` **antes** do `setImmediate`/`Promise` que despacha o job; passar `slug` explicitamente para `PublicationBuildJob.run(publicacaoId, projetoId, empresaSlug)`
- [ ] `src/modules/pub/application/publication-build-job.ts` — aceitar `empresaSlug` como parâmetro; chamar `EmpresaContext.run(slug, async () => { ... })` envolvendo toda a lógica do build; verificar que `EmpresaContext.getSlug()` dentro do job retorna o slug correto
- [ ] `src/modules/pub/application/empresa-context-propagation.spec.ts` — unit test: job iniciado após resolução do request tem `EmpresaContext.getSlug()` = slug do request; job de `empresaA` não contamina contexto de job simultâneo de `empresaB` (dois jobs paralelos, slugs distintos)
- [ ] `src/modules/pub/observability/pub-logger.service.ts` — incluir `empresa` (de `EmpresaContext.getSlug()`) em todos os logs do job

## Criterios de aceite
- [ ] `pnpm test src/modules/pub/application/empresa-context-propagation.spec.ts` exits 0
- [ ] Dois builds paralelos de empresas distintas não compartilham `EmpresaContext` (isolamento verificado no spec)
- [ ] Queries Prisma no job usam schema do `EmpresaContext` corretamente (verificado via spy em `PrismaService.forSchema`)

## Dependencias
- PUB-004 (PublicationBuildJob)
- PUB-013 (EmpresaContext AsyncLocalStorage)

## Estimativa
S

## Prioridade
P5
