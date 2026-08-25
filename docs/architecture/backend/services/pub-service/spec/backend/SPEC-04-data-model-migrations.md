# SPEC-04 — Data Model & Migrations

**Module:** PUB · **Refs:** `contracts/data-model.md`, `adr/ADR-003-epubcheck-validation-port.md`,
shared `ADR-003-multi-tenancy.md`.

## Objetivo

Especificar as tabelas `publicacao` e `validation_message` (schema per-tenant), enums, invariantes de
integridade e o plano de migração Prisma.

## Escopo

- **In:** DDL canônica (data-model §2), índices (incluindo o parcial único de único-em-voo), enums,
  cascade LGPD, plano de migração.
- **Out:** apagamento de artefatos em storage (SPEC-06/SPEC-10 — `PublicationErasurePort`); consumo do DDL
  (é `node-migration-generator.py`).

## Decisões técnicas

- `publicacao` carrega **dois** campos de estado: `status` (máquina) e `epubcheck_status` (veredito) — D-Q.
- Invariante `chk_publicacao_artefato`: `artefato_ref` não-nulo **sse e somente se** `status='publicado'`.
- Único-em-voo: `CREATE UNIQUE INDEX ... ON publicacao (projeto_id) WHERE status IN ('gerando','validando')`
  — no máximo um build não-terminal por projeto (D-R).
- `sequencia` única por projeto (`uq_publicacao_projeto_seq`); próximo valor calculado no app dentro do
  tenant (histórico append-only).
- FK `projeto_id → projeto_editorial ON DELETE CASCADE` (intra-schema; backstop de integridade LGPD).
- `validation_message` filho de `publicacao` (cascade); `total_erros`/`total_avisos` derivados no persist.

## Implementação

- Migração inicial `V0001__create_publicacao_validation_message` (2 tabelas + enums + índices).
- Prisma mapeia `TEXT + CHECK` para enums; DDL replicada em cada `emp_<slug>` pela rotina de provisionamento
  (RULE-07). `cordele_global` não recebe tabelas de PUB.

## Casos de borda

- Tentar 2º build em voo → viola índice parcial → o app já retorna o em-voo antes de inserir (SPEC-05).
- `sequencia` concorrente → colisão em `uq_publicacao_projeto_seq` → retry do cálculo (SPEC-05).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL persist a publicacao only with status in {gerando,validando,publicado,com_erros} and
  epubcheck_status in {valido,avisos,erros_criticos,pendente}.`
- `THE SYSTEM SHALL hold at most one publicacao per project in gerando or validando (partial unique index).`
- `THE SYSTEM SHALL set artefato_ref non-null exactly when status is publicado.`
- `THE SYSTEM SHALL keep total_erros/total_avisos equal to the count of validation_message rows of severity
  error/warning.`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its publicacoes and their
  validation_message rows.`
