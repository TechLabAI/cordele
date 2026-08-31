# COMP-002 -- [DECISÃO] A1 Multi-tenancy: RESOLVIDA POR PRECEDENTE — schema-per-tenant

**Status:** DONE -- resolvida por precedente em M5 (scaffold); corrigida 2026-08-30
**Maturidade:** 3 -- Resolvido
**Done/Total:** 3/3 itens

> **Nota de correção (2026-08-30):** a decisão original registrada aqui ("Opção C — empresaId
> discriminador, precedente imp-service/proj-service") estava **factualmente errada**. Inspeção
> direta do código de `imp-service` (`prisma-manuscrito.repository.ts`,
> `TenantPrismaFactory.withTenant()`) e `proj-service` (`tenant-prisma.factory.ts`) mostra que
> ambos usam **schema-per-tenant** (`PrismaClient` por schema `emp_<slug>`), não uma coluna
> `empresaId` discriminadora — nenhum `schema.prisma` do monorepo tem esse campo em model algum;
> `empresaId` é só o parâmetro em memória que seleciona o schema. O comentário de cabeçalho nos
> `schema.prisma` desses serviços ("every tenant-scoped table carries an empresaId discriminator")
> é boilerplate desatualizado, não reflete os models reais. A decisão abaixo foi corrigida para o
> padrão real, que também é o que `CLAUDE.md` documenta ("Isolation is per schema in Postgres") e o
> que o COMP já implementa desde a P3 via `PrismaEmpresaService`.

## Decisão (M5 — 2026-08-25, corrigida 2026-08-30)

**Opção A — schema-per-tenant** (`SET search_path` / `PrismaClient` dedicado por schema
`emp_<slug>`), consistente com o precedente real de `imp-service` e `proj-service` e com
`project-context.json`/`CLAUDE.md`.

Padrão adoptado (idêntico ao `proj-service`/`imp-service`):
- Nenhuma coluna `empresaId` nos models tenant-scoped — o isolamento é por schema Postgres.
- `PrismaEmpresaService` (COMP) / `TenantPrismaFactory` (PROJ, IMP) mantém um `PrismaClient` por
  schema, resolvido via `AsyncLocalStorage` a partir do claim JWT.
- Slug de empresa é validado por regex antes de qualquer interpolação em nome de schema
  (proteção contra injection).
- Provisioning de tenant (G8) é concern de infra (fora do escopo do COMP nesta fase).

**Rationale:** a inspeção direta do código (não apenas dos comentários de cabeçalho) confirma que
`imp-service` e `proj-service` já implementam schema-per-tenant real. Manter o COMP alinhado à
implementação real dos outros serviços — e ao que `CLAUDE.md` documenta — é mais correto do que
seguir uma decisão registrada com base numa leitura equivocada do precedente.

## Spec de referencia
- SPEC-04 (data-model — isolamento por empresa)
- SPEC-06 (security — schema resolvido do claim JWT, nunca do caller)
- Precedente real: `backend/services/imp-service/src/infrastructure/persistence/prisma-manuscrito.repository.ts` (`TenantPrismaFactory.withTenant`)
- Precedente real: `backend/services/proj-service/src/infrastructure/persistence/tenant-prisma.factory.ts`
- `docs/architecture/shared/multi-empresa.md`

## Escopo

- [x] Decisão documentada: Opção A — schema-per-tenant (corrigida 2026-08-30)
- [x] COMP-012 alinhado: verificação de roteamento por schema em todas as queries Prisma (não filtro empresaId)
- [x] `PrismaEmpresaService` implementado (`src/infrastructure/persistence/prisma-empresa.service.ts`) com `AsyncLocalStorage` + validação de slug

## Criterios de aceite

- [x] Decisão registrada antes de COMP-009 e COMP-012 iniciarem
- [x] Schema.prisma do COMP não tem coluna `empresaId` (isolamento por schema, não por discriminador)
- [x] Padrão consistente com o código real de imp-service e proj-service (verificado por inspeção direta, não por comentário de cabeçalho)

## Dependencias

Nenhuma (issue de decisão — precede COMP-009 e COMP-012).

## Estimativa
S

## Prioridade
P1
