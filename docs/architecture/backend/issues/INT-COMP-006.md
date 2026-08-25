# INT-COMP-006 -- EmpresaContext tenant schema provisioning (G8 shared platform concern)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Gap G8: provisioning of the tenant schema (`emp_<slug>`) is a shared platform concern that
must run before any COMP (or PROJ/IMP/PUB) table can be queried. PROJ provisions
`projeto_editorial` first (FK backstop for COMP); COMP's `metadados` and
`configuracao_layout` are created in the same tenant schema by replaying the migrations
from V0001..V0003 against `emp_<slug>`. This issue specifies the provisioning script/utility
that runs the DDL against a new tenant schema at tenant bootstrap time. Only applicable if
COMP-002 chose Opção A (schema-per-tenant).

The provisioner is a shared utility (not COMP-owned alone) but COMP must contribute its
DDL block; this issue tracks COMP's contribution to and validation of that shared provisioner.

## Spec de referencia
- SPEC-04 (data-model — schema-per-tenant provisioning, G8)
- `contracts/data-model.md` §6 (migration plan — `emp_<slug>` provisioning order)
- `docs/architecture/backend/adr/ADR-003-multi-tenancy.md`

## Escopo

Files to create / amend (relative to monolith root `backend/`):

- [ ] `scripts/provision-tenant.ts` (amend or create) — accepts `slug` argument; validates slug against `[a-z][a-z0-9_]{1,30}`; creates schema `emp_<slug>` if not exists; runs PROJ DDL (projeto_editorial) then COMP DDL (V0001..V0003) in order; idempotent (IF NOT EXISTS guards)
- [ ] `scripts/provision-tenant.spec.ts` — provision `emp_test`: verify `metadados`, `configuracao_layout`, `layout_override` tables exist in `emp_test` schema; FK references `projeto_editorial` in same schema; re-run is idempotent

## Criterios de aceite

- [ ] `pnpm ts-node scripts/provision-tenant.ts emp_aetos` creates `emp_aetos.metadados`, `emp_aetos.configuracao_layout`, `emp_aetos.layout_override` with all constraints
- [ ] FK `ON DELETE CASCADE` from `metadados` and `configuracao_layout` to `projeto_editorial` verified in provisioned schema
- [ ] Re-running provisioner on existing schema makes no changes (idempotent, no error)
- [ ] `pnpm test` on provisioning spec exits 0

## Dependencias

- COMP-002 (precede — Opção A tenancy decision required)
- COMP-009 (precede — DDL SQL from migrations is the source)
- PROJ-008 (precede — PROJ provisioning must run before COMP; FK dependency)

## Estimativa
M

## Prioridade
P3
