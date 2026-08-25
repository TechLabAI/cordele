# Plano -- PUB (pub-service, Publicação)

## Status das prioridades

- P1 -- pendente
- P2 -- pendente
- P3 -- pendente
- P4 -- pendente
- P5 -- pendente
- P6 -- pendente
- P7 -- pendente
- P8 -- pendente
- P9 -- pendente

---

## 0. Leitura executiva

### Papel do serviço

`pub-service` é o módulo de **Publicação** do monólito modular Cordelê: é a autoridade sobre o
aggregate `Publicacao` e o ciclo de vida assíncrono de geração de ePub 3. Orquestra a leitura do
manuscrito (IMP), composição editorial (COMP), montagem do pacote OCF/ePub (`EpubBuilder`),
validação via epubcheck (`EpubValidationPort`), persistência do artefato (`.epub` em
`FileStoragePort`) e notificação ao projeto (PROJ.`advanceTo`). Exporta in-process
`PublicationHistoryPort` e `PublicationErasurePort` para PROJ.

### MVP scope

Trigger de export (POST → 202) → polling de status (GET status → Retry-After) → desfecho terminal
(`publicado`/`com_erros`) → download por URL assinada de TTL curto → histórico T08 → KPIs T07/T08 →
ports exportados (history + erasure para PROJ) → BDD cobrindo D-N/D-R/D-P/D-Q/D-F/D-O/D-G.

### Diagnóstico inicial (gaps mapeados em doc 06 / M3)

- **G1 — Lista detalhada de avisos:** api-contract atual expõe apenas contagens; FE só renderiza
  contagens. Novo endpoint §4.6 proposto (PUB-016 — requer ratificação FE antes do promote).
- **G2 — KPIs de tamanho/páginas/capítulos/imagens:** sem campo-fonte definido; tile FE omitido
  indefinidamente até decisão de produto (fora do MVP).
- **G3 — Build órfão:** crash em `gerando`/`validando` bloqueia futuros exports pelo índice parcial;
  reconciliação automática é pós-POC; PUB-020 documenta runbook operacional.
- **G4 — Step definitions manuais:** DataTable `has the following publicacoes:`, step de JRE/JAR
  ausente e cenário `emAndamento=1` não geráveis automaticamente; PUB-019.

---

## 1. Estratégia geral

### Objetivo macro

Entregar um `PubModule` NestJS compilável, testável e com cobertura BDD completa das decisões
D-N/D-R/D-P/D-Q/D-F/D-O/D-G — em 9 prioridades que o agente `be-implement` pode executar uma a uma.

### Ordem das prioridades

| P | Título | Motivo |
|---|---|---|
| P1 | Scaffold + domain | Módulo deve compilar; agregados puros desbloqueiam tudo |
| P2 | Use cases core | Golden path: trigger → polling → stats → download |
| P3 | Persistência + migration | Repositórios Prisma e schema-per-tenant desbloqueiam testes reais |
| P4 | Adapters de infra | EpubBuilder + epubcheck + storage + stubs desbloqueiam o build end-to-end |
| P5 | Security + propagação tenant | JWT guard + EmpresaContext no job assíncrono |
| P6 | Ports exportadas + integrações | history/erasure exportados; adapters reais de IMP/COMP/PROJ |
| P7 | Observabilidade | Correlação + logging + health/epubcheck |
| P8 | BDD | Steps manuais + execução dos 3 feature files |
| P9 | Hardening | Runbook de build órfão |

---

## 2. Plano por prioridade

### Prioridade 1 -- Scaffold + domain
Status: pendente

#### Objetivo / Resultado esperado
`pnpm build` passa com `PubModule` + `PubController` (5 rotas stub) + entidades de domínio puras.

#### Issues vinculadas
- PUB-001 (PubModule skeleton + PubController)
- PUB-002 (domain aggregates + enums + state machine)

#### Specs cobertas
- SPEC-01 (api-surface — rotas, DI tokens, DTOs)
- SPEC-02 (build-orchestration — state machine D-Q)
- SPEC-04 (data-model — enums, invariantes)

#### Sequência de execução
- Fase 1: PUB-001 — criar PubModule, PubController (stubs), DI tokens, DTOs
- Fase 2: PUB-002 — criar entidades de domínio puras, enums, PublicationStatus VO

#### Criterios de aceite
- `pnpm build` exits 0
- `pnpm test` nos specs de controller e domain exits 0
- Nenhum arquivo de domínio importa Prisma ou NestJS

#### Riscos
- Conflito de port com outro módulo (pub-service usa porta 3000 — verificar monólito)

#### Instrução para implementador
Criar os arquivos listados nas issues. Seguir naming de COMP-001 como referência. Não implementar
lógica de negócio em P1 — apenas stubs que retornam 200/202/204.

---

### Prioridade 2 -- Use cases core
Status: pendente

#### Objetivo / Resultado esperado
Golden path completo: trigger → polling → stats → download — testado com mocks de todas as portas.

#### Issues vinculadas
- PUB-003 (GeneratePublicationUseCase)
- PUB-004 (PublicationBuildJob)
- PUB-005 (PublicationQueryService)
- PUB-006 (GetPublicationStatsUseCase)

#### Specs cobertas
- SPEC-02 (build-orchestration)
- SPEC-05 (idempotency-concurrency)
- SPEC-11 (publication-kpis)

#### Sequência de execução
- Fase 1: PUB-003 — GeneratePublicationUseCase + pré-flight + portas de interface
- Fase 2: PUB-004 — PublicationBuildJob + ports EpubValidation/FileStorage/ProjectStatus
- Fase 3: PUB-005 + PUB-006 — query services + KPIs

#### Criterios de aceite
- `pnpm test` nos specs de todos os use cases exits 0
- Cenário em-voo retorna `publicacaoId` existente sem criar segunda `Publicacao`
- `emAndamento=1` coberto nos specs de PUB-006

#### Riscos
- Interfaces de `ICompositionReadPort` devem alinhar com o que COMP exporta (verificar comp api-contract §6)

#### Instrução para implementador
Declarar todas as interfaces de porta em `src/modules/pub/ports/` antes de implementar os use cases.
Usar mocks Jest para todas as portas nos unit tests.

---

### Prioridade 3 -- Persistência + migrations
Status: pendente

#### Objetivo / Resultado esperado
Schema Prisma validado, migration V0001 aplicável em PostgreSQL 16, repositórios com schema-per-tenant.

#### Issues vinculadas
- PUB-007 (Prisma schema + migration)
- PUB-008 (repositórios adapters)

#### Specs cobertas
- SPEC-04 (data-model-migrations)
- SPEC-05 (idempotency — índice parcial, nextSequencia)

#### Sequência de execução
- Fase 1: PUB-007 — schema.prisma + migration SQL + PrismaService
- Fase 2: PUB-008 — repositórios + mapper + testes de integração

#### Criterios de aceite
- `npx prisma validate` exits 0
- Índice parcial `uq_publicacao_projeto_inflight` presente no SQL
- `pnpm test` nos specs de repositório exits 0

#### Riscos
- Schema-per-tenant: Prisma Client URL dinâmica pode conflitar com connection pooling

#### Instrução para implementador
DDL canônico está em `contracts/data-model.md` §2.1/§2.2. Usar exatamente os nomes de coluna do DDL
canônico — o mapper faz a conversão para camelCase.

---

### Prioridade 4 -- Adapters de infraestrutura
Status: pendente

#### Objetivo / Resultado esperado
Pipeline de build end-to-end executável: EpubBuilder → epubcheck child process → FileStorage disk → stubs IMP/COMP.

#### Issues vinculadas
- PUB-009 (EpubBuilder domain service)
- PUB-010 (EpubcheckValidationAdapter)
- PUB-011 (DiskFileStorageAdapter)
- PUB-012 (stubs IMP/COMP)

#### Specs cobertas
- SPEC-03 (epub-assembly-and-validation)
- SPEC-10 (integrations — adapters de infra)

#### Sequência de execução
- Fase 1: PUB-012 — stubs (desbloqueiam testes sem IMP/COMP reais)
- Fase 2: PUB-009 — EpubBuilder (domain, sem infra)
- Fase 3: PUB-010 — EpubcheckValidationAdapter
- Fase 4: PUB-011 — DiskFileStorageAdapter

#### Criterios de aceite
- `pnpm test` em todos os specs exits 0
- JAR ausente → com_erros (nunca publica não validado — ADR-003)
- `delete` idempotente para artefato inexistente

#### Riscos
- EpubBuilder produz ZIP OCF: avaliar biblioteca (archiver vs jszip) antes de implementar
- `EPUBCHECK_JAR_PATH` ausente em CI → health DOWN, mas builds de P4 podem rodar com mock

#### Instrução para implementador
O EpubBuilder é domínio puro — zero dependências de NestJS/Prisma. O mapeamento de layout honrado
está em `contracts/integration-contracts.md` §2.3 (SPEC-03 §2).

---

### Prioridade 5 -- Security + propagação de tenant
Status: pendente

#### Objetivo / Resultado esperado
JWT guard com scopes `pub:read`/`pub:write`; `EmpresaContext` disponível dentro do job assíncrono.

#### Issues vinculadas
- PUB-013 (OAuth2 guard + EmpresaContext middleware)
- INT-PUB-006 (EmpresaContext propagation para o build job)

#### Specs cobertas
- SPEC-06 (security)

#### Sequência de execução
- Fase 1: PUB-013 — guard + EmpresaContext
- Fase 2: INT-PUB-006 — propagação explícita de slug para o job assíncrono

#### Criterios de aceite
- Request sem token → 401; scope insuficiente → 403
- Dois jobs paralelos de empresas distintas não compartilham EmpresaContext

#### Riscos
- `AsyncLocalStorage` perde contexto ao sair da callstack síncrona — INT-PUB-006 trata isso explicitamente

#### Instrução para implementador
Capturar `EmpresaContext.getSlug()` **antes** do despacho do job. Passar slug como parâmetro
explícito para `PublicationBuildJob.run`.

---

### Prioridade 6 -- Ports exportadas + integrações
Status: pendente

#### Objetivo / Resultado esperado
`PublicationHistoryPort` e `PublicationErasurePort` injetáveis em PROJ; adapters reais de IMP/COMP/PROJ.

#### Issues vinculadas
- PUB-014 (PublicationHistoryPort)
- PUB-015 (PublicationErasurePort)
- PUB-016 (endpoint lista detalhada de avisos — GAP, requer ratificação FE)
- INT-PUB-001 (ManuscriptContentPort adapter real)
- INT-PUB-002 (CompositionReadPort adapter real)
- INT-PUB-003 (ProjectStatusPort adapter real)
- INT-PUB-004 (DI wiring ProjModule para history)
- INT-PUB-005 (DI wiring ProjModule para erasure)

#### Specs cobertas
- SPEC-10 (integrations — ports exportadas, adapters reais)
- `contracts/integration-contracts.md` §1/§2

#### Sequência de execução
- Fase 1: PUB-014 + PUB-015 — portas exportadas implementadas
- Fase 2: INT-PUB-001 + INT-PUB-002 + INT-PUB-003 — adapters reais (requer módulos irmãos disponíveis)
- Fase 3: INT-PUB-004 + INT-PUB-005 — DI wiring em ProjModule
- Fase 4: PUB-016 — endpoint de lista de avisos (somente após ratificação FE)

#### Criterios de aceite
- `PUBLICATION_HISTORY_PORT` e `PUBLICATION_ERASURE_PORT` injetáveis em ProjModule
- `latest` com N projetoIds executa 1 query (sem N+1)
- `purge` idempotente (segunda chamada sem erro)

#### Riscos
- PUB-016 (lista de avisos) bloqueada por aprovação FE — não promover para produção sem ratificação

#### Instrução para implementador
INT-PUB-001/002/003 dependem dos tokens exportados por IMP/COMP/PROJ respectivamente. Verificar
que os módulos irmãos exportam os tokens esperados antes de implementar os adapters.

---

### Prioridade 7 -- Observabilidade
Status: pendente

#### Issues vinculadas
- PUB-017 (correlation interceptor + logging + build diagnostics)
- PUB-018 (health/readiness + epubcheck availability)

#### Specs cobertas
- SPEC-07 (observability-health)

#### Sequência de execução
- Fase 1: PUB-017 — interceptor + logger estruturado
- Fase 2: PUB-018 — health indicators + endpoint

#### Criterios de aceite
- `X-Correlation-Id` em todas as respostas
- Health DOWN quando `EPUBCHECK_JAR_PATH` ausente

---

### Prioridade 8 -- BDD end-to-end
Status: pendente

#### Issues vinculadas
- PUB-019 (step definitions manuais + cenário emAndamento)

#### Specs cobertas
- SPEC-08 (bdd-test-scenarios)

#### Critérios de aceite
- `pnpm test test/pub/pub.bdd.spec.ts` exits 0
- Todos os 3 feature files executados sem `undefined step`

---

### Prioridade 9 -- Hardening
Status: pendente

#### Issues vinculadas
- PUB-020 (runbook build órfão)

#### Critérios de aceite
- Runbook descreve cenário, critério de identificação e passos de correção verificáveis

---

## 3. Dependências externas

| Dependência | Direção | Quem fornece | Quando necessário |
|---|---|---|---|
| `ManuscriptContentPort` (IMP) | PUB importa | ImpModule | P6 (INT-PUB-001); stub em P4 (PUB-012) |
| `GetMetadadosUseCase` + layout (COMP) | PUB importa | CompModule | P6 (INT-PUB-002); stub em P4 |
| `AdvanceProjetoStatusUseCase.advanceTo` (PROJ) | PUB chama | ProjModule | P6 (INT-PUB-003); stub em P4 |
| `PublicationHistoryPort` | PROJ importa de PUB | PubModule | P6 (INT-PUB-004) |
| `PublicationErasurePort` | PROJ importa de PUB | PubModule | P6 (INT-PUB-005) |
| epubcheck JAR + JRE | PUB infra | ops/local | P4 (PUB-010); `EPUBCHECK_JAR_PATH` |
| FileStorage (disco) | PUB infra | local disk | P4 (PUB-011); `PUB_STORAGE_ROOT` |

---

## 4. Restrições arquiteturais (stack: node)

- `eslint-plugin-boundaries` — camadas `modules/`/`domain/`/`infrastructure/` (ver standards `node-hexagonal-patterns`); nenhum arquivo de `domain/` importa `@nestjs/*` ou `@prisma/*`
- Transações Prisma somente na camada `application/` (nunca em `domain/`)
- `EmpresaContext` (AsyncLocalStorage) é o único mecanismo de propagação de tenant — nunca via path/query/body
- Build job assíncrono: usar `setImmediate` ou `Promise.resolve().then(...)` sem bloquear thread do request
- `advanceTo` chamado **no máximo uma vez** por desfecho terminal
- ePub nunca publicado sem validação epubcheck (ADR-003 promessa central)
- Bytes do `.epub` jamais servidos via app — somente URL assinada curta (D-F)

---

## 5. Referências

- `docs/architecture/backend/services/pub-service/contracts/api-contract.md`
- `docs/architecture/backend/services/pub-service/contracts/data-model.md`
- `docs/architecture/backend/services/pub-service/contracts/integration-contracts.md`
- `docs/architecture/backend/services/pub-service/contracts/hub-integration.md`
- `docs/architecture/backend/services/pub-service/spec/backend/SPEC-01..11.md`
- `docs/architecture/backend/services/pub-service/tests/cucumber/*.feature`
- `docs/architecture/backend/services/pub-service/adr/ADR-001..003.md`
- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
- `docs/architecture/backend/adr/ADR-002-modular-monolith.md`
- `docs/architecture/backend/adr/ADR-003-multi-tenancy.md`
- `docs/architecture/backend/issues/issues_map-PUB.md`
