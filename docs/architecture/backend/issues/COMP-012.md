# COMP-012 -- EmpresaContext schema-per-tenant routing in COMP Prisma adapters (RULE-07)

**Status:** INTACT -- gerado 2026-08-25, corrigido 2026-08-30 (premissa de A1 estava errada — ver nota)
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

> **Nota de correção (2026-08-30):** o texto original desta issue afirmava que COMP-002 resolveu A1
> como "Opção C — empresaId discriminador (precedente imp-service/proj-service)". Isso estava
> **factualmente errado**: `proj-service` (`src/infrastructure/persistence/tenant-prisma.factory.ts`)
> usa **schema-per-tenant** (um `PrismaClient` dinâmico por schema `emp_<slug>`), com um comentário no
> próprio código explicando que `SET LOCAL search_path` sozinho não isola tenants corretamente com o
> connection pooling do Prisma. Não existe coluna `empresaId` em nenhum model do `schema.prisma` de
> nenhum service do monorepo. Isso também é o que `CLAUDE.md` documenta ("Isolation is per schema in
> Postgres"). O escopo abaixo foi corrigido para o padrão real (schema-per-tenant), que o COMP já
> implementa desde a P3 via `PrismaEmpresaService`.

## Contexto

Todo acesso a dado no COMP deve ser roteado para o schema Postgres da empresa ativa
(`emp_<slug>`), nunca para `public` ou schema fixo. O roteamento é feito por
`PrismaEmpresaService` (`src/infrastructure/persistence/prisma-empresa.service.ts`): mantém um
`PrismaClient` por schema, resolve o slug via `AsyncLocalStorage` (`runWithSlug`/`getCurrentSlug`),
e valida o slug com regex antes de qualquer interpolação (proteção contra injection via nome de
schema). `EmpresaContextService`/`EmpresaContextMiddleware`
(`src/infrastructure/auth/empresa-context.service.ts` + `.middleware.ts`) populam o contexto de
requisição a partir do claim JWT logo após o `JwtAuthGuard`. A ausência de contexto populado é um
data leak silencioso (query cairia no schema errado ou lançaria).

## Spec de referencia
- SPEC-04 (data-model — isolamento por empresa)
- SPEC-06 (security — schema resolvido do claim JWT, nunca do caller)
- Precedente real: `backend/services/proj-service/src/infrastructure/persistence/tenant-prisma.factory.ts` (schema-per-tenant, D-619)
- `docs/architecture/shared/multi-empresa.md`

## Escopo

Files to create or verify (relative to `backend/services/comp-service/`):

- [x] `src/infrastructure/persistence/prisma-empresa.service.ts` — `PrismaClient` por schema `emp_<slug>`; `AsyncLocalStorage` (`runWithSlug`/`getCurrentSlug`); valida slug com regex antes de interpolação
- [x] `src/infrastructure/auth/empresa-context.service.ts` + `empresa-context.middleware.ts` — popula o contexto de empresa a partir do claim JWT após o `JwtAuthGuard`
- [x] Verificar que todos os repositories em COMP-010/COMP-011 usam `PrismaEmpresaService.getCurrentSlug()`/o `PrismaClient` escopado ao schema corrente em toda query (`findMany`/`findUnique`/`update`/`delete`) — nunca um client de schema fixo (confirmado em `infrastructure/comp/persistence/{metadados,configuracao-layout}.repository.ts`)
- [x] Verificar que `comp.module.ts` injeta `EmpresaContextService`/`PrismaEmpresaService` nos adapters antes da fase P3 (ambos `@Global()` — `AuthModule` e `PersistenceModule` — disponíveis via `AppModule`, composition root; não precisa de import direto em `comp.module.ts` por RULE-04)

## Criterios de aceite

- [x] Todas as queries COMP passam pelo `PrismaClient` roteado ao schema da empresa ativa (verificado nas specs dos adapters, incluindo teste de tenant isolation com Testcontainers em `metadados.repository.spec.ts`/`configuracao-layout.repository.spec.ts`)
- [x] Contexto de empresa não populado (JWT ausente/inválido) resulta em erro antes de qualquer query BD (`EmpresaContextMiddleware` roda antes dos guards; `PrismaEmpresaService.getCurrentSlug()` lança se `AsyncLocalStorage` vazio)
- [x] `pnpm test` nos specs de `PrismaEmpresaService`/`EmpresaContextService` exits 0
- [x] Slug de empresa é validado (regex) antes de qualquer interpolação em nome de schema (proteção contra injection) — `prisma-empresa.service.ts`

## Dependencias

- COMP-002 (precede — decisão A1 DONE Opção C)
- COMP-010 (precede — MetadadosRepository deve existir para ter filtro validado)
- COMP-011 (precede — ConfiguracaoLayoutRepository deve existir)
- COMP-013 (precede — JWT guard popula EmpresaContext antes do scope check)

## Estimativa
M

## Prioridade
P3
