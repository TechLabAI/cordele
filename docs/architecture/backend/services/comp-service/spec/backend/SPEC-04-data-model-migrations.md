# SPEC-04 — Data Model & Migrations

**Module:** COMP · **Refs:** `contracts/data-model.md` (canonical `sql`), shared `adr/ADR-003-multi-tenancy.md`,
local `adr/ADR-002`, `adr/ADR-003`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir o esquema persistente de COMP (`metadados`, `configuracao_layout`, `layout_override`), suas
constraints, e o plano de migração Prisma schema-per-tenant. Os blocos ` ```sql ` de `data-model.md` são o
contrato canônico consumido por `node-migration-generator.py` / `node-entity-generator.py`.

## Escopo

- **In:** três tabelas COMP na schema do tenant (`emp_<slug>`); FKs de backstop para `projeto_editorial`;
  CHECKs de bounds/enums; UNIQUE por `projetoId`; migrações Prisma `V0001..V0003`.
- **Out:** `projeto_editorial` (PROJ); manuscrito/content tree (IMP); binário da capa (FileStoragePort, não
  é tabela); provisionamento por-tenant (plataforma, G8).

## Decisões técnicas

- **Dois agregados (D-M/G7):** `metadados` e `configuracao_layout`, cada um 1:1 com o projeto
  (`UNIQUE(projeto_id)`), materializados lazy no 1º PUT. `layout_override` é filho de `configuracao_layout`
  (FK cascade).
- **Bounds no DB e no domínio:** CHECKs (`fonte_corpo_tamanho 12..20`, `espacamento_linha 1.2..2.0`,
  `margem_lateral 10..40`, headings `14..48`, `h1≥h2≥h3`) espelham os VOs (defense-in-depth).
- **Override read-reference (ADR-002):** `referencia_no` é referência lógica ao nó do IMP; **não** há FK
  cross-table para o manuscrito. `tipo IN (imagem, em-branco)` no enum; `em-branco` rejeitado na app (D-H).
  `chk_override_imagem_alinhado` exige `alinhamento` quando `tipo=imagem`.
- **Capa fora do DB (ADR-003):** `capa_url` guarda referência; bytes ficam no `FileStoragePort`.

## Implementação

- DDL canônica em `data-model.md` §2.1–§2.3 → `schema.prisma` + migrações:
  `V0001__create_metadados`, `V0002__create_configuracao_layout`, `V0003__create_layout_override`.
- `-- schema: empresa` no topo de cada bloco → gerador roteia o DDL para a schema do tenant.
- Provisionamento: o DDL é replicado em cada `emp_<slug>`; PROJ (`projeto_editorial`) provisiona antes
  (COMP referencia-o por FK). Prisma single-schema é contornado pelo targeting em runtime (RULE-07).

## Casos de borda

- Segundo `metadados`/`configuracao_layout` para o mesmo projeto → violação de UNIQUE.
- `espacamento_linha` fora de 1.2..2.0 → CHECK rejeita.
- Override duplicado no mesmo `referencia_no` → UNIQUE `uq_override_no` rejeita.
- Delete de `projeto_editorial` → cascade backstop remove linhas COMP; binário da capa é purgado pela porta (SPEC-10).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL keep at most one metadados and one configuracao_layout row per projetoId.`
- `IF any typography value is out of its bound OR h1<h2 or h2<h3, THEN THE SYSTEM SHALL reject the row (CHECK).`
- `IF tipo=imagem AND alinhamento is null, THEN THE SYSTEM SHALL reject the override row (CHECK).`
- `THE SYSTEM SHALL store COMP tables in the tenant schema targeted from EmpresaContext (RULE-07).`
- `THE SYSTEM SHALL reference the manuscript node by a logical referencia_no, never a cross-table FK.`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete COMP rows (FK backstop); the cover binary is purged by CompositionErasurePort (SPEC-10).`
