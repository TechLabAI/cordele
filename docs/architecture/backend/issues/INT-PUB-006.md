# INT-PUB-006 -- EmpresaContext propagation para o build job assíncrono (multi-tenant isolation)

**Status:** REDUCED -- pos-validacao 2026-09-03
**Maturidade:** 6 -- Inicial
**Done/Total:** 1/7 itens

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

- [x] `src/modules/pub/use-cases/generate-publication.use-case.ts` — (path real: `use-cases/`); captura `empresaId` **antes** de `Promise.resolve().then(...)` (fora do AsyncLocalStorage síncrono); passa via `EmpresaContextRunner.runAs(empresaId, fn, bearerToken)`; verificado P12
- [x] `src/modules/pub/use-cases/publication-build.job.ts` — (path real: `use-cases/`, nome `publication-build.job.ts`); recebe `empresaId` em `PublicationBuildJobInput`; wrapping via `EmpresaContextRunner.runAs` feito no caller (`GeneratePublicationUseCase`); verificado P12
- [ ] `src/modules/pub/use-cases/empresa-context-propagation.spec.ts` — NÃO EXISTE spec dedicada de isolamento de contexto entre jobs paralelos; comportamento testado funcionalmente via BDD (22/22 scenarios PASS); gap identificado em P12
- [x] `src/modules/pub/observability/pub-logger.service.ts` — inclui `empresa` (de `EmpresaContextService.getEmpresaId()`) em logs; verificado P12

## Criterios de aceite
- [ ] `pnpm test empresa-context-propagation.spec.ts exits 0` — NÃO EXISTE spec dedicada (gap identificado)
- [ ] Dois builds paralelos não compartilham EmpresaContext — NÃO TESTADO por spec dedicada; arquitetura usa `AsyncLocalStorage` que garante isolamento por callstack
- [x] Queries Prisma no job usam schema do EmpresaContext — verificado: `EmpresaContextRunner.runAs` wraps o job inteiro, `PrismaService` resolve search_path via `EmpresaContextService`

## Dependencias
- PUB-004 (PublicationBuildJob)
- PUB-013 (EmpresaContext AsyncLocalStorage)

## Estimativa
S

## Prioridade
P5
