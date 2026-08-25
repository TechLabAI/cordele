# COMP-012 -- EmpresaContext empresaId tenant filter in COMP Prisma adapters (RULE-07)

**Status:** INTACT -- gerado 2026-08-25 (escopo alinhado ao COMP-002 Opção C em M5)
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

COMP-002 (M5) resolveu A1 como **Opção C — empresaId discriminador** (precedente imp-service /
proj-service). Portanto o escopo desta issue NÃO é schema targeting (`SET search_path`) mas sim
garantir que todos os adapters Prisma do COMP aplicam o filtro `WHERE empresaId = ?` derivado do
`EmpresaContext` (NestJS `AsyncLocalStorage`). A ausência do filtro é um data leak silencioso.

Schema-per-tenant (`SET search_path = emp_<slug>`) fica como upgrade futuro (gap G8/infra),
fora do escopo desta issue e desta fase.

## Spec de referencia
- SPEC-04 (data-model — `empresaId` leading all unique/index)
- SPEC-06 (security — `empresaId` resolvido do claim JWT, nunca do caller)
- Precedente: `backend/services/proj-service/src/infrastructure/` (empresaId pattern)
- COMP-002 (decisão A1 — Opção C)

## Escopo

Files to create or verify (relative to `backend/services/comp-service/`):

- [ ] `src/infrastructure/auth/empresa-context.service.ts` — wraps `AsyncLocalStorage<{ empresaId: string }>` por request; resolve `empresaId` do claim JWT após autenticação pelo `JwtAuthGuard`
- [ ] `src/infrastructure/auth/empresa-context.service.spec.ts` — mock EmpresaContext: `empresaId` UUID válido propagado; sem JWT → `UnauthorizedException` antes de qualquer query
- [ ] Verificar que todos os repositories em COMP-010/COMP-011 passam `empresaId` como filtro obrigatório nas queries Prisma (leading condition de todos os `findMany`/`findUnique`/`update`/`delete`)
- [ ] Verificar que `comp.module.ts` injeta `EmpresaContextService` nos adapters antes da fase P3

## Criterios de aceite

- [ ] Todas as queries COMP incluem `WHERE "empresaId" = $empresaId` como primeira condição (verificado nas specs dos adapters)
- [ ] `EmpresaContext` não populado (JWT ausente / inválido) resulta em `UnauthorizedException` antes de qualquer query BD
- [ ] `pnpm test` no spec do EmpresaContextService exits 0
- [ ] Schema Prisma de COMP tem `empresaId` em `Comp` base model (já gerado pelo scaffold M5)

## Dependencias

- COMP-002 (precede — decisão A1 DONE Opção C)
- COMP-010 (precede — MetadadosRepository deve existir para ter filtro validado)
- COMP-011 (precede — ConfiguracaoLayoutRepository deve existir)
- COMP-013 (precede — JWT guard popula EmpresaContext antes do scope check)

## Estimativa
M

## Prioridade
P3
