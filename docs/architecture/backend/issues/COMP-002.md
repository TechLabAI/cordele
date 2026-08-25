# COMP-002 -- [DECISÃO] A1 Multi-tenancy: RESOLVIDA POR PRECEDENTE — empresaId discriminador

**Status:** DONE -- resolvida por precedente em M5 (scaffold)
**Maturidade:** 3 -- Resolvido
**Done/Total:** 3/3 itens

## Decisão (M5 — 2026-08-25)

**Opção C — empresaId discriminador em schema único** (resolvido por precedente `imp-service` e
`proj-service`, ambos gerados nesta mesma corrida do pipeline). NÃO schema-per-tenant; NÃO
schema único sem discriminador.

Padrão adoptado (idêntico ao `proj-service`):
- Cada tabela tenant-scoped carrega `empresaId UUID NOT NULL` como coluna discriminadora.
- `empresaId` lidera todos os `@@unique` e `@@index`, garantindo cobertura de índice em todos
  os filtros de tenant.
- A camada de aplicação resolve `empresaId` do claim JWT via `EmpresaContext` (NestJS
  `AsyncLocalStorage`) e aplica o filtro em TODAS as queries Prisma — ausência do filtro é
  um data leak, não uma query lenta (sem RLS no Prisma).
- Schema único (`cordele` default / `DATABASE_URL` padrão do `.env`).
- Provisioning de tenant (G8) é concern de infra (fora do escopo do COMP nesta fase).

**Rationale:** `project-context.json` declara `schema-per-tenant` como intenção de longo prazo
(Opção A), mas o POC do BA rodou single-schema e os dois serviços já produzidos adoptaram
`empresaId` discriminador como camada de isolamento pragmática. Manter consistência intra-monorepo
é prioridade sobre o ideal arquitectural declarado; o upgrade para schema-per-tenant real fica
registado como gap G8/infra.

## Spec de referencia
- SPEC-04 (data-model — `empresaId` leading all unique/index)
- SPEC-06 (security — `empresaId` resolvido do claim JWT, nunca do caller)
- Precedente: `backend/services/imp-service/prisma/schema.prisma`
- Precedente: `backend/services/proj-service/prisma/schema.prisma`

## Escopo

- [x] Decisão documentada: Opção C — empresaId discriminador, schema único
- [x] COMP-012 alinhado: schema targeting substituído por filtro empresaId em todas as queries Prisma
- [x] DDL gerado com `empresaId UUID NOT NULL` em `metadados`, `configuracao_layout`, `layout_override` (indirecto via FK)

## Criterios de aceite

- [x] Decisão registrada antes de COMP-009 e COMP-012 iniciarem
- [x] Schema.prisma e migration DDL usam empresaId (verificado no scaffold M5)
- [x] Padrão consistente com imp-service e proj-service

## Dependencias

Nenhuma (issue de decisão — precede COMP-009 e COMP-012).

## Estimativa
S

## Prioridade
P1
