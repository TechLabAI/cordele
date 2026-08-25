# SPEC-04 — Data Model & Migrations

**Module:** PROJ · **Refs:** `contracts/data-model.md`, shared `adr/ADR-003-multi-tenancy.md`,
local `adr/ADR-002` / `adr/ADR-003`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Fixar o modelo persistido de PROJ (canónico nos blocos ```sql``` do `data-model.md`) e a estratégia de
migração Prisma schema-per-tenant.

## Escopo

- **In:** `projeto_editorial` (raiz da cascata, único escritor de status), `projeto_status_historico`
  (auditoria append-only, gap G1); migrações `V0001`/`V0002`; aplicação por tenant.
- **Out:** `publicacao` (não é tabela do PROJ — ADR-003), `manuscrito`/`metadados`/`configuracao_layout`
  (IMP/COMP).

## Decisões técnicas

- **PK** UUID v4 `gen_random_uuid()` (core no PG16). **TIMESTAMPTZ** UTC. **snake_case**; Prisma mapeia.
- **Tenant schema** `emp_<slug>` para ambas as tabelas; `editora` fica em `cordele_global` e é referência
  **lógica** (não FK cross-schema) — validada na aplicação.
- **Histórico** escrito só em mudança real; nunca em no-op idempotente (SPEC-02).
- **Migração** via `prisma migrate`; DDL replicada em cada `emp_<slug>` pela rotina de provisionamento;
  `projeto_editorial` provisiona **antes** das tabelas de IMP/COMP/PUB (é a raiz das FKs cascade).

## Implementação

Tabelas e DDL canónica: `contracts/data-model.md` §2.1 (`projeto_editorial`), §2.2
(`projeto_status_historico`). Migrações: `V0001__create_projeto_editorial`,
`V0002__create_projeto_status_historico`.

## Casos de borda

- `status` fora do enum → rejeitado por `chk_projeto_status`.
- `nome` em branco → rejeitado por `chk_projeto_nome`.
- `solicitado_por` fora de {imp,pub,comp,editor,system} → rejeitado por `chk_psh_solicitante`.
- Deleção do projeto → `projeto_status_historico` cai por FK cascade; dados cross-context via cascata
  orquestrada (SPEC-11).

## Critérios de aceite (EARS)

- `IF status is not in {rascunho, em_composicao, publicado, com_erros}, THEN THE SYSTEM SHALL reject the row.`
- `IF nome is blank, THEN THE SYSTEM SHALL reject the row.`
- `WHEN status changes, THE SYSTEM SHALL set atualizado_em=now() and insert one projeto_status_historico row.`
- `THE SYSTEM SHALL apply projeto_editorial DDL to every tenant schema before IMP/COMP/PUB tables (cascade root order).`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its projeto_status_historico.`
