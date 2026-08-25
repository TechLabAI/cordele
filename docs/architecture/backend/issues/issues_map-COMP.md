# Issues Map — COMP (Composição)

> Gerado por `/be-architect-backlog cordele COMP` em 2026-08-25.
> Serviço: `comp-service` · Stack: Node 22 / NestJS 11 / pnpm / Prisma / PostgreSQL 16.
> Total: 20 issues funcionais + 6 issues de integração = 26 issues.

---

## 1. Por SPEC de referência

| SPEC | Issues |
|---|---|
| SPEC-01 (api-surface) | COMP-001, COMP-013 |
| SPEC-02 (metadata + cover) | COMP-003, COMP-004, COMP-005 |
| SPEC-03 (layout + overrides + preview) | COMP-006, COMP-007, COMP-008 |
| SPEC-04 (data model + migrations) | COMP-002, COMP-009, COMP-012, INT-COMP-006 |
| SPEC-05 (idempotency + concurrency) | COMP-004, COMP-007, COMP-010, COMP-017 |
| SPEC-06 (security) | COMP-013 |
| SPEC-07 (observability + health) | COMP-018, COMP-019 |
| SPEC-08 (BDD) | COMP-020 |
| SPEC-09 (messaging) | n/a (`messaging.enabled=false`) |
| SPEC-10 (integrations) | COMP-014, COMP-015, COMP-016, COMP-017, INT-COMP-001, INT-COMP-002, INT-COMP-003, INT-COMP-004, INT-COMP-005 |

---

## 2. Por prioridade

| P | Issues funcionais | Issues INT | Foco |
|---|---|---|---|
| P1 | COMP-001, COMP-002 | — | Scaffold + decisão multi-tenancy |
| P2 | COMP-003, COMP-004, COMP-005, COMP-006, COMP-007, COMP-008 | — | Domain puro + use cases core |
| P3 | COMP-009, COMP-010, COMP-011, COMP-012 | INT-COMP-006 | Persistência + migrations + schema targeting |
| P4 | COMP-014, COMP-015 | INT-COMP-001, INT-COMP-002 | Adapters externos (IMP/storage) |
| P5 | COMP-013 | — | Security (JWT guard + scopes) |
| P6 | COMP-016, COMP-017 | INT-COMP-003, INT-COMP-004, INT-COMP-005 | Exported ports (PUB + PROJ) |
| P7 | COMP-018, COMP-019 | — | Observabilidade + health |
| P8 | COMP-020 | — | BDD end-to-end |

---

## 3. Por camada (hexagonal — `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`)

### modules/ (api layer — controller + DTOs)
- COMP-001 (CompModule skeleton + CompController)
- COMP-013 (JWT guard + scope-check)
- COMP-018 (correlation middleware)
- COMP-019 (health endpoint)

### application/ (use cases)
- COMP-004 (UpdateMetadadosUseCase + GetMetadadosViewUseCase)
- COMP-005 (UploadCoverUseCase + RemoveCoverUseCase)
- COMP-007 (UpdateLayoutUseCase)
- COMP-008 (GetLayoutPreviewUseCase)
- COMP-016 (GetMetadados/GetConfiguracaoLayout export for PUB)
- COMP-017 (ProjectMetadataPort + CompositionErasurePort export for PROJ)

### domain/
- COMP-002 ([DECISÃO] Multi-tenancy A1)
- COMP-003 (Metadados aggregate + VOs)
- COMP-006 (ConfiguracaoLayout aggregate + LayoutOverride entity + VOs)

### infrastructure/persistence/
- COMP-009 (Prisma schema + migrations V0001..V0003)
- COMP-010 (MetadadosRepository adapter)
- COMP-011 (ConfiguracaoLayoutRepository adapter)
- COMP-012 (EmpresaContext schema targeting)
- INT-COMP-006 (tenant provisioning script)

### infrastructure/storage/
- COMP-015 (FileStoragePort disk adapter POC)
- INT-COMP-002 (FileStoragePort S3 adapter prod)

### infrastructure/manuscript/
- COMP-014 (ManuscriptContentPort stub)
- INT-COMP-001 (ManuscriptContentPort real IMP adapter)

### integrations (cross-module wiring)
- INT-COMP-003 (COMP→PUB export ports wiring)
- INT-COMP-004 (COMP→PROJ ProjectMetadataPort wiring)
- INT-COMP-005 (COMP→PROJ CompositionErasurePort wiring)

### tests/
- COMP-020 (BDD step definitions — 8 features, 44 scenarios + 4 outlines)

---

## 4. Decisões-chave

| # | Decisão | Issue | Pré-condição de outras |
|---|---|---|---|
| A1 | Multi-tenancy: Opção A (schema-per-tenant) vs Opção B (single schema POC) | COMP-002 | COMP-009, COMP-012 bloqueiam nesta decisão |
| D-H | `em-branco` rejeitado na aplicação (422); `imagem` é o único override MVP | COMP-007 | Scoped para BDD COMP-020 |
| D-K | Preview = dados, nunca pixels; ManuscriptContentPort read-only | COMP-008, COMP-014 | INT-COMP-001 substitui stub |
| D-M | Defaults lazy: GET antes do PUT retorna `materialized=false`; não persiste | COMP-004, COMP-008 | — |
| D-I | PUB lê COMP via in-process ports, nunca HTTP direto | COMP-016, INT-COMP-003 | PUB scaffold deve existir |

---

## 5. Warnings para M5 (BE scaffold)

1. **COMP-002 deve ser resolvido PRIMEIRO** — scaffold não pode gerar DDL/adapter sem saber o isolamento de schema.
2. **JWT guard (COMP-013)** implementa `EmpresaContext` antes de COMP-012 (schema targeting) ser completado; a sequência de dependência deve ser respeitada.
3. **ManuscriptContentPort stub** (COMP-014) é o fallback de pré-IMP; a troca por INT-COMP-001 deve ser feita quando IMP exportar seu query port.
4. **FK ON DELETE CASCADE** em V0001 e V0002 referencia `projeto_editorial` (PROJ); PROJ deve ser scaffoldado/migrado antes do COMP em qualquer ambiente compartilhado.
5. **CompositionErasurePort.purge** (COMP-017) deleta binário da capa via `FileStoragePort.delete` antes de deletar a linha — ordem importa para consistência.
