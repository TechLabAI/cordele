# Issues Map — PUB (Publicação)

**Gerado:** 2026-08-25  
**Serviço:** `pub-service` · **Stack:** Node 22 / NestJS 11 / Prisma / PostgreSQL 16  
**Total:** 20 issues funcionais + 6 de integração

---

## 1. Por prioridade

| P | Issue | Título | Estimativa |
|---|---|---|---|
| P1 | PUB-001 | NestJS PubModule skeleton + PubController com 5 rotas | M |
| P1 | PUB-002 | Domain aggregates: Publicacao, ValidationMessage, enums, state machine | M |
| P2 | PUB-003 | GeneratePublicationUseCase: trigger + pre-flight + idempotência | L |
| P2 | PUB-004 | PublicationBuildJob: orquestração assíncrona gerando→validando→terminal | L |
| P2 | PUB-005 | PublicationQueryService: getStatus, listByProjeto, downloadUrl | M |
| P2 | PUB-006 | GetPublicationStatsUseCase: projeção de KPIs ao vivo (SPEC-11, D-O) | S |
| P3 | PUB-007 | Prisma schema (publicacao + validation_message) + migration V0001 | M |
| P3 | PUB-008 | PublicacaoRepository + ValidationMessageRepository adapters | M |
| P4 | PUB-009 | EpubBuilder domain service: montagem OCF/ePub 3 determinística | L |
| P4 | PUB-010 | EpubValidationPort adapter: epubcheck child-process + parse do relatório | M |
| P4 | PUB-011 | FileStoragePort disk adapter: store, signUrl, readImage, delete | M |
| P4 | PUB-012 | Stub adapters in-process para IMP (ManuscriptContentPort) e COMP | S |
| P5 | PUB-013 | OAuth2 guard + EmpresaContext middleware + scopes pub:read/pub:write | M |
| P5 | INT-PUB-006 | EmpresaContext propagation para o build job assíncrono | S |
| P6 | PUB-014 | PublicationHistoryPort implementation exportada para PROJ | M |
| P6 | PUB-015 | PublicationErasurePort implementation (purge LGPD) exportada para PROJ | S |
| P6 | PUB-016 | Endpoint de lista detalhada de avisos epubcheck {code, msg, location} (GAP) | M |
| P6 | INT-PUB-001 | ManuscriptContentPort adapter: wiring in-process com IMP | S |
| P6 | INT-PUB-002 | CompositionReadPort adapter: wiring in-process com COMP | S |
| P6 | INT-PUB-003 | ProjectStatusPort adapter: wiring in-process com PROJ.advanceTo | S |
| P6 | INT-PUB-004 | PublicationHistoryPort: registro DI em ProjModule | S |
| P6 | INT-PUB-005 | PublicationErasurePort: registro DI em ProjModule (LGPD cascade) | S |
| P7 | PUB-017 | Correlation interceptor + structured JSON logging + build diagnostics | M |
| P7 | PUB-018 | Health/readiness endpoint incluindo disponibilidade do epubcheck | S |
| P8 | PUB-019 | BDD Cucumber step definitions manuais: DataTable, JRE/JAR, emAndamento | M |
| P9 | PUB-020 | Reconciliação de build órfão: runbook operacional para MVP | S |

---

## 2. Por SPEC

| SPEC | Issues vinculadas |
|---|---|
| SPEC-01 (api-surface) | PUB-001, PUB-005, PUB-006, PUB-016 |
| SPEC-02 (build-orchestration) | PUB-003, PUB-004, INT-PUB-003, PUB-020 |
| SPEC-03 (epub-assembly-and-validation) | PUB-009, PUB-010, PUB-018, PUB-019 |
| SPEC-04 (data-model-migrations) | PUB-007, PUB-008, PUB-020, INT-PUB-005 |
| SPEC-05 (idempotency-concurrency) | PUB-003, PUB-008, PUB-020 |
| SPEC-06 (security) | PUB-011, PUB-013, INT-PUB-006 |
| SPEC-07 (observability-health) | PUB-017, PUB-018 |
| SPEC-08 (bdd-test-scenarios) | PUB-006, PUB-019 |
| SPEC-09 (messaging-architecture) | — (messaging.enabled=false; sem issues) |
| SPEC-10 (integrations) | PUB-012, INT-PUB-001, INT-PUB-002, INT-PUB-003, INT-PUB-004, INT-PUB-005 |
| SPEC-11 (publication-kpis-read-model) | PUB-006 |

---

## 3. Por módulo (camada hexagonal NestJS)

| Camada | Issues |
|---|---|
| `src/modules/pub/` (controller + DTOs) | PUB-001 |
| `src/domain/pub/` (entidades + VOs + eventos) | PUB-002, PUB-009 |
| `src/modules/pub/application/` (use cases) | PUB-003, PUB-004, PUB-005, PUB-006, PUB-014, PUB-015, PUB-016, INT-PUB-006 |
| `src/modules/pub/ports/` (interfaces) | PUB-003, PUB-004 |
| `src/modules/pub/auth/` (guards) | PUB-013 |
| `src/modules/pub/observability/` (interceptors + logging) | PUB-017 |
| `src/modules/pub/health/` (health indicators) | PUB-018 |
| `src/infrastructure/pub/persistence/` (adapters Prisma) | PUB-007, PUB-008 |
| `src/infrastructure/pub/validation/` (epubcheck adapter) | PUB-010 |
| `src/infrastructure/pub/storage/` (disk storage adapter) | PUB-011 |
| `src/infrastructure/pub/stubs/` (stubs de teste) | PUB-012 |
| `src/infrastructure/pub/integration/` (adapters in-process) | INT-PUB-001, INT-PUB-002, INT-PUB-003 |
| `src/modules/proj/` (DI wiring PROJ) | INT-PUB-004, INT-PUB-005 |
| `test/pub/` (BDD step definitions) | PUB-019 |
| `scripts/` + `docs/runbook` | PUB-020 |

---

## 4. Gaps explícitos mapeados como issues

| Gap (origem M3) | Issue | Decisão |
|---|---|---|
| Lista detalhada de avisos {code,msg,location} — sem endpoint no api-contract | PUB-016 | Novo endpoint §4.6 — requer ratificação FE antes do promote |
| KPIs de resumo do ePub (tamanho/páginas/capítulos/imagens) — sem campo-fonte | — | Fora do MVP (tile omitido); pós-POC se BA confirmar os dados |
| Step `epubcheck cannot execute due to a missing JRE or JAR path` — step definition manual | PUB-019 | Step configurável via fake de EpubValidationPort |
| Step DataTable `project {string} has the following publicacoes:` — step definition manual | PUB-019 | DataTable canônico para fixtures multi-linha |
| Cenário BDD `emAndamento=1` — ausente no feature file atual | PUB-019 | Acrescentado ao feature file de polling |
| Reconciliação de build órfão (crash em gerando/validando) — sem timeout automático no MVP | PUB-020 | Runbook operacional + script manual; sem automação no POC |

> **Nota:** o gap de KPIs de tamanho/páginas/capítulos/imagens do ePub não está mapeado como issue porque
> não há campo-fonte definido no api-contract nem na data-model. O tile FE permanece omitido até que o BA
> confirme a fonte (pós-POC). Criar issue só após decisão de produto.

---

## 5. Dependências entre issues (sequência recomendada)

```
PUB-001 → PUB-002 → PUB-003 → PUB-004 → PUB-009 → PUB-010
                  ↓            ↓
               PUB-007 → PUB-008
                  ↓
               PUB-005 → PUB-014 → INT-PUB-004
               PUB-006            → INT-PUB-005 ← PUB-015
               PUB-011 → PUB-012
               PUB-013 → INT-PUB-006
               INT-PUB-001 → (substitui PUB-012 para IMP)
               INT-PUB-002 → (substitui PUB-012 para COMP)
               INT-PUB-003 → (substitui stub PROJ)
               PUB-017, PUB-018 (P7 — paralelo após P6)
               PUB-019 (P8 — requer P4 + P6 concluídos)
               PUB-020 (P9 — last)
```
