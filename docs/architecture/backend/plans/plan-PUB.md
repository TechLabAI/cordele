# Plano -- PUB (pub-service, Publicação)

## Status das prioridades

- P1 -- DONE
- P2 -- DONE
- P3 -- DONE
- P4 -- DONE
- P5 -- DONE
- P6 -- DONE (PUB-014 DONE, PUB-015 DONE, PUB-016 DONE; INT-PUB-001 DONE, INT-PUB-003 DONE; INT-PUB-002 concluida em P10)
- P7 -- DONE (PUB-017: Correlation interceptor + structured logging. PUB-018: Health endpoint com epubcheck liveness check. 2026-08-26 17:59)
- P8 -- DONE (PUB-019: BDD step definitions manuais + execução dos 3 feature files; 22/22 scenarios PASS @ 2026-08-26 19:08)
- P9 -- DONE (PUB-020: Runbook + findStaleInFlight + script reconciliação; todos [x] confirmados @ 2026-09-02)
- P10 -- DONE (INT-PUB-002: adapters HTTP CompCompositionMetadataAdapter + CompCompositionLayoutAdapter criados; wiring em PubInfraBindingsModule; test=PASS lint=PASS build=PASS arch-conformance=OK 5/5 @ 2026-09-02)
- P11 -- DONE (REGRESS-INT-PUB-002: asserções runAs corrigidas com 3º arg bearerToken; prisma-client/** adicionado aos ignores ESLint; test=PASS 143/143 lint=PASS build=PASS arch-conformance=OK 5/5 @ 2026-09-02)
- P12 -- DONE (Reconciliar checklist: paths divergentes corrigidos em 18 issues; itens verificados marcados [x]; gaps reais documentados com [ ]; score --write-back executado em todas; 108/157 itens done @ 2026-09-03)
- P13 -- DONE (PUB-021: código de P13 executado @ 2026-09-03T04:48:59Z — schema Prisma, EpubBuilder, BuildJob e DTOs; itens PUB-021 [MISSING] são drift de path — ADR-004 existe em adr/ de serviço, implementação existe mas não foi marcada)
- P14 -- pendente (Reconciliar DRIFT: 14 itens PARTIAL/MISSING de 8 issues são drift de naming/path — PUB-002, PUB-003, PUB-005, PUB-007, PUB-013, PUB-016, PUB-018, PUB-021)
- P15 -- pendente (Criar 4 specs ausentes: prisma.service.spec.ts, jwt-auth.guard.spec.ts, publication-history.service.spec.ts, publication-erasure.service.spec.ts — PUB-007, PUB-013, PUB-014, PUB-015)
- P16 -- pendente (Domain events PUB-004: publication-succeeded.event.ts + publication-failed.event.ts + wiring no BuildJob)

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

- **G1 — Lista detalhada de avisos:** RESOLVIDO — PUB-016 implementado (9/10 itens done).
- **G2 — KPIs de tamanho/páginas/capítulos/imagens:** RESOLVIDO parcialmente — ADR-004 decidido
  (PUB-021: tamanho_bytes, total_capitulos, total_imagens; paginas omitido permanentemente).
  Implementação de código pendente em P13.
- **G3 — Build órfão:** RESOLVIDO — PUB-020 runbook + findStaleInFlight + script one-shot entregues.
- **G4 — Step definitions manuais:** RESOLVIDO — PUB-019 22/22 scenarios PASS.

### Estado 2026-09-03 (pós P12+P13)

Score: **58/100** Parcial (provisional — test/build/e2e deferred no último tier-light). Gates tier-light:
lint=PASS arch-conformance=PASS(5/5). Checklist: **163/187 done (87%)** — 24 itens restantes em
11 issues. P13 foi executado (código completo); os 2 MISSING de PUB-021 são drift de path que P14 resolve.
Diagnóstico dos 24 itens: **14 DRIFT** (naming/path diverge entre spec e código real) +
**6 REAL** (specs de teste ausentes + 2 event files) + **4 NÃO-VERIFICÁVEL** (gates comportamentais
que se tornam verificáveis após P15/P16). Ver seção 2 para classificação detalhada por issue.

### Multi-empresa

EmpresaContext configurado via AsyncLocalStorage em `empresa-context.service.ts`. Schemas alvo:
`cordele_global` (auth/RBAC) + `emp_aetos` (dados de publicação). Propagação assíncrona implementada
em `PublicationBuildJob` via `runAs(empresaId, fn, bearerToken)` (P5/INT-PUB-006 + P10/P11).

---

## 1. Estratégia geral

### Objetivo macro

Fechar o módulo PUB: 163/187 done (87%). Os 24 itens restantes classificam em 14 DRIFT + 6 REAL
+ 4 NÃO-VERIFICÁVEL. P14 resolve os 14 DRIFT via reconciliação de paths/naming. P15 cria 4 specs
ausentes (6 REAL + 3 NÃO-VERIFICÁVEL). P16 implementa domain events PUB-004 (2 REAL + 1
NÃO-VERIFICÁVEL). Após P14+P15+P16: 187/187, validator deve fechar o módulo com score >= 90.

### Classificação de itens restantes por issue

| Issue | done/total | Itens MISSING/PARTIAL | Classificação | Evidência |
|---|---|---|---|---|
| PUB-002 | 7/10 | 3 PARTIAL | **DRIFT** (3/3) | publication-status.vo.ts → publicacao-status.enum.ts; pub.enums.ts → enums individuais; pub.domain.spec.ts → publicacao.entity.spec.ts |
| PUB-003 | 9/12 | 3 PARTIAL | **DRIFT** (3/3) | modules/.../publicacao-repository.port.ts existe; composition-read.port.ts → split em 2; project-status.port.ts → advance-projeto-status.port.ts |
| PUB-004 | 9/12 | 3 MISSING | **REAL** (2) + **NÃO-VERIFICÁVEL** (1) | event files ausentes confirmados; dispatch timing é comportamental |
| PUB-005 | 7/8 | 1 PARTIAL | **DRIFT** (1/1) | publication-query.spec.ts → specs individuais em use-cases/ (7 arquivos) |
| PUB-007 | 7/10 | 2 PARTIAL + 1 MISSING | **DRIFT** (1) + **REAL** (1) + **NÃO-VERIFICÁVEL** (1) | database.module.ts funcional; prisma.service.spec.ts ausente; gate depende do spec |
| PUB-013 | 7/9 | 2 PARTIAL | **DRIFT** (1) + **REAL** (1) | require-scope.decorator.ts existe (nome diverge); jwt-auth.guard.spec.ts ausente (guard.ts existe) |
| PUB-014 | 7/9 | 2 MISSING | **REAL** (1) + **NÃO-VERIFICÁVEL** (1) | publication-history.service.spec.ts ausente; gate depende do spec |
| PUB-015 | 6/8 | 2 MISSING | **REAL** (1) + **NÃO-VERIFICÁVEL** (1) | publication-erasure.service.spec.ts ausente; gate depende do spec |
| PUB-016 | 9/10 | 1 MISSING | **DRIFT** (1/1) | §4.6 validation-messages existe em contracts/api-contract.md do serviço; checker buscou path relativo |
| PUB-018 | 6/8 | 2 PARTIAL | **DRIFT** (2/2) | pub-health.module.ts funcional; health.controller.ts existe (app.health.controller.ts era nome esperado) |
| PUB-021 | 5/7 | 2 MISSING | **DRIFT** (2/2) | ADR-004 existe em adr/ do serviço; EpubBuilder+BuildJob+schema implementados em P13 |

### Ordem das prioridades

| P | Título | Motivo | Issues |
|---|---|---|---|
| P1..P11 | DONE | Implementação core completa | PUB-001..020, INT-PUB-001..006 |
| P12 | DONE — Reconciliar checklist geral | Código existia; issues não marcadas; 108/157 reconciliados | PUB-002..018 |
| P13 | DONE — Implementar PUB-021 EpubSummaryVM | ADR-004; Prisma schema + EpubBuilder + BuildJob + DTOs | PUB-021 |
| P14 | Reconciliar DRIFT (14 itens em 8 issues) | Naming/path diverge entre spec e código real; checker falhou por path; marcar done | PUB-002, PUB-003, PUB-005, PUB-007, PUB-013, PUB-016, PUB-018, PUB-021 |
| P15 | Criar 4 specs ausentes | Specs de serviço dedicadas não existem; gate "pnpm test X exits 0" bloqueados | PUB-007, PUB-013, PUB-014, PUB-015 |
| P16 | Domain events PUB-004 | 2 event files ausentes confirmados; job usa callbacks diretos em vez de domain events | PUB-004 |

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
Status: DONE (PUB-014, PUB-015, PUB-016 DONE; INT-PUB-001, INT-PUB-003 DONE; INT-PUB-002 concluida em P10; INT-PUB-004, INT-PUB-005 DONE)

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
Status: DONE (2026-08-26 19:08 — 22/22 scenarios PASS, all phases completed)

#### Issues vinculadas
- PUB-019 (step definitions manuais + cenário emAndamento)

#### Specs cobertas
- SPEC-08 (bdd-test-scenarios)
- SPEC-11 (publication-kpis — `emAndamento` semantics)
- SPEC-03 (epub-assembly §borda — epubcheck inexecutável → com_erros)

#### Objetivo

Implementar os step definitions BDD dos 3 feature files já existentes em
`test/bdd/features/`. Todos os cenários estão marcados `test.skip` (scaffoldado);
o objetivo é remover o `.skip` e implementar cada step com fakes em memória,
de modo que `pnpm test:bdd` exits 0 com 0 cenários undefined.

#### Problemas identificados

1. Todos os steps em `publication-build-async-polling.steps.ts`,
   `epubcheck-validation-verdict.steps.ts` e
   `publication-history-download-and-erasure.steps.ts` estão com
   `TODO[BDD]` — não executam nenhuma lógica.
2. `test/bdd/steps/shared.ts` tem 3 funções stub vazias — precisam
   de uma implementação que opere sobre estado de teste compartilhado.
3. O step `project {string} has the following publicacoes:` (DataTable) não
   tem infraestrutura de seed — requer `InMemoryPublicacaoRepository`.
4. O step `epubcheck cannot execute due to a missing JRE or JAR path` não
   tem stub configurável para `EpubValidationPort` — requer fake que lança
   `EpubcheckUnavailableError`.
5. O cenário `emAndamento=1` (build em voo → `stats.emAndamento=1`) está
   ausente do feature file `publication-build-async-polling.feature`.
6. O critério de aceite da issue usa path incorreto `test/pub/pub.bdd.spec.ts`;
   o runner correto é `pnpm test:bdd` (= `jest --config test/jest-bdd.json`).

#### Alvos de alteração (caminhos completos relativos ao repositório)

Novos arquivos a criar:
- `backend/services/pub-service/test/bdd/steps/test-context.ts`
- `backend/services/pub-service/test/bdd/steps/in-memory-publicacao.repository.ts`

Arquivos a modificar:
- `backend/services/pub-service/test/bdd/steps/shared.ts`
- `backend/services/pub-service/test/bdd/features/publication-build-async-polling.feature`
- `backend/services/pub-service/test/bdd/publication-build-async-polling.steps.ts`
- `backend/services/pub-service/test/bdd/epubcheck-validation-verdict.steps.ts`
- `backend/services/pub-service/test/bdd/publication-history-download-and-erasure.steps.ts`

#### Contrato operacional

Deve existir:
- `InMemoryPublicacaoRepository` implementando `PublicacaoRepositoryPort` completo (todos os métodos)
- `BddTestContext` interface com: `inMemoryRepo`, `epubValidationPort`, `manuscriptContentPort`,
  `compositionMetadataPort`, `compositionLayoutPort`, `advanceProjetoStatusPort`,
  `fileStoragePort`, `empresaContextService`, `lastStatus: number`, `lastBody: unknown`
- `createBddTestContext(): BddTestContext` — fábrica de contexto limpo por cenário
- `setCurrentContext(ctx)` + `getCurrentContext()` — acesso pelo `shared.ts`
- Novo cenário `Scenario: KPI emAndamento is 1 while a build is in progress` no feature file

Não deve existir:
- Nenhum import de `@prisma/client` nos arquivos de teste BDD
- Nenhuma chamada HTTP real (sem `supertest`, sem NestJS TestingModule) — steps chamam
  use-cases diretamente com fakes
- `test.skip` em qualquer cenário após a implementação

Verificação objetiva:
- `cd backend/services/pub-service && pnpm test:bdd` exits 0
- Saída do jest não contém `undefined step`, `Skipped`, nem `TODO[BDD]` em runtime

Condição de bloqueio:
- `EpubcheckUnavailableError` ausente em `src/domain/pub/` → criar antes do step stub

#### Sequência de execução

**Fase 1 — Infraestrutura de teste BDD (`test/bdd/steps/`)**

Criar `test/bdd/steps/in-memory-publicacao.repository.ts`:
- Classe `InMemoryPublicacaoRepository implements PublicacaoRepositoryPort`
- Estado: `private rows: Map<string, PublicacaoEntity> = new Map()`
- `findInFlight(projetoId)`: busca row com `status === 'gerando' || 'validando'` para o projeto
- `nextSequencia(projetoId)`: conta rows do projeto + 1
- `save(pub)`: `rows.set(pub.id, pub)`, retorna `pub`
- `findById(projetoId, publicacaoId)`: busca `rows.get(publicacaoId)` onde `projetoId` bate
- `listByProjeto(projetoId)`: filtra por `projetoId`, ordena por `sequencia DESC`
- `findLatestByProjetoIds(ids)`: para cada id, busca a row com maior `sequencia`
- `findByPublicacaoId(id)`: `rows.get(id) ?? null`
- `deleteAllByProjeto(projetoId)`: remove todas as rows do projeto

Criar `test/bdd/steps/test-context.ts`:
- Importa: `InMemoryPublicacaoRepository`, todos os ports de `src/modules/pub/ports/`, use-cases de `src/modules/pub/use-cases/`, `EmpresaContextService` de `src/infrastructure/auth/`
- Interface `BddTestContext` com: `inMemoryRepo: InMemoryPublicacaoRepository`, fakes `jest.Mocked<...>` de todos os outbound ports, `empresaContextService: EmpresaContextService`, `lastStatus: number`, `lastBody: unknown`, `lastError: unknown`
- `function createBddTestContext(): BddTestContext`: cria `InMemoryPublicacaoRepository` + `jest.fn()` para cada port externo + instancia os use-cases com injeção direta + `EmpresaContextService` real
- `let _current: BddTestContext | null = null`
- `export function setCurrentContext(ctx: BddTestContext): void`
- `export function getCurrentContext(): BddTestContext`

Padrão de inicialização nos steps files:
```ts
let ctx: BddTestContext;
beforeEach(() => { ctx = createBddTestContext(); setCurrentContext(ctx); });
```

**Fase 2 — Implementar `test/bdd/steps/shared.ts`**

Substituir os 3 stubs:
- `anAuthenticatedEditorOfEmpresaAetosWithScopePubW()`: chama `getCurrentContext().empresaContextService.runAs('emp_aetos', () => {})` para inicializar o ALS; em seguida seta `ctx.empresaId = 'emp_aetos'` no contexto
- `theResponseStatusIs200()`: `expect(getCurrentContext().lastStatus).toBe(200)`
- `theResponseStatusIs409()`: `expect(getCurrentContext().lastStatus).toBe(409)`

**Fase 3 — Criar `test/bdd/steps/pub-fixture.steps.ts`** (novo arquivo, importado pelos steps files que precisam do step DataTable)

Expõe a função `seedPublicacoesFromDataTable(projetoId: string, table: Record<string, string>[]): void`:
- Para cada linha da tabela (colunas: `status`, `epubcheckStatus`, `sequencia`, opcional `artefatoRef`):
  - Cria `PublicacaoEntity` com os valores explícitos via construtor direto (não via `iniciar` — o estado já é fornecido)
  - Chama `ctx.inMemoryRepo.save(entity)`

Pitfall mitigado: step text `project {string} has the following publicacoes:` usa `{string}` (não escaped quote) — a expressão Cucumber parseia corretamente.

**Fase 4 — Implementar `publication-history-download-and-erasure.steps.ts`**

Remover todos os `test.skip`. Adicionar `beforeEach` + `setCurrentContext`.

Steps DataTable (`project "proj-100" has the following publicacoes:`): chamar `seedPublicacoesFromDataTable` com a DataTable passada pelo jest-cucumber (segundo argumento do step body).

Steps singulares (`publicacao "pub-2" of "proj-100" is publicado with epubcheckStatus "avisos"`): criar `PublicacaoEntity` diretamente e inserir no `inMemoryRepo`.

Steps when (`the editor lists publications`): chamar `GetPublicationHistoryUseCase.execute({projetoId})` dentro de `empresaContextService.runAs('emp_aetos', ...)`, armazenar resultado em `ctx.lastBody`, `ctx.lastStatus = 200`.

Steps when download (`GET download url`): chamar `GetSignedDownloadUrlUseCase.execute({publicacaoId})` — se bem sucedido `status=200`, se lançar exceção de não-publicado `status=409`.

Steps when stats: chamar `GetPublicationStatsUseCase.execute({projetoId})`.

Steps then: fazer `expect` sobre `ctx.lastBody` + `ctx.lastStatus`.

**Fase 5 — Implementar `epubcheck-validation-verdict.steps.ts`**

Remover todos os `test.skip`. Adicionar `beforeEach` + `setCurrentContext`.

Step `epubcheck cannot execute due to a missing JRE or JAR path`:
- Verificar se `EpubcheckUnavailableError` existe em `src/domain/pub/`; se não existir, criá-lo como `class EpubcheckUnavailableError extends Error {}` nesse arquivo
- `ctx.epubValidationPort.validate.mockRejectedValue(new EpubcheckUnavailableError('JRE not found'))`

Step `the assembled ePub for project "proj-100" passes epubcheck with no messages`:
- `ctx.epubValidationPort.validate.mockResolvedValue({ verdict: 'valido', messages: [] })`

Step `the assembled ePub fails epubcheck with N errors`:
- `ctx.epubValidationPort.validate.mockResolvedValue({ verdict: 'erros_criticos', messages: [...N error messages...] })`

Step `the build job for project "proj-100" completes`:
- Seed uma `PublicacaoEntity` em `gerando` no `inMemoryRepo`
- Chamar `PublicationBuildJob.run({publicacaoId, projetoId})` dentro do `empresaContextService.runAs`
- Capturar a `PublicacaoEntity` salva via `inMemoryRepo.findById` e armazenar em `ctx.lastBody`

Steps then (`publicacao status is "publicado"`): `expect((ctx.lastBody as PublicacaoEntity).status).toBe('publicado')`.

**Fase 6 — Adicionar cenário `emAndamento=1` ao feature file**

Arquivo: `test/bdd/features/publication-build-async-polling.feature`

Acrescentar ao final do arquivo (antes de EOF):
```gherkin
Scenario: KPI emAndamento is 1 while a build is in progress
  Given project "proj-100" has the following publicacoes:
    | status   | epubcheckStatus | sequencia |
    | gerando  | pendente        | 1         |
  When the editor reads the publication stats for "proj-100"
  Then the response status is 200
  And the stats field "emAndamento" is 1
  And the stats field "publicadas" is 0
```

**Fase 7 — Implementar `publication-build-async-polling.steps.ts`**

Remover todos os `test.skip`. Adicionar `beforeEach` + `setCurrentContext`.

Step `an existing project "proj-100" in the active empresa`: armazena `ctx.projetoId = 'proj-100'`.

Step `project "proj-100" has an imported manuscript`: configura `ctx.manuscriptContentPort.getContentTree.mockResolvedValue({...})`.

Step `project "proj-100" has complete metadata with titulo "..." autor "..." idioma "..."`:
configura `ctx.compositionMetadataPort.get.mockResolvedValue({...})`.

Step `the editor triggers an export for project "proj-100"`:
- Chamar `GeneratePublicationUseCase.execute({projetoId: 'proj-100'})` dentro do `empresaContextService.runAs`
- Se bem sucedido: `ctx.lastStatus = 202`, `ctx.lastBody = {publicacaoId, status: 'gerando', ...}`
- Se lançar `ManuscriptMissingError`: `ctx.lastStatus = 409`, `ctx.lastBody = {type: 'urn:cordele:pub:manuscript-missing'}`
- Se lançar `MetadataIncompleteError`: `ctx.lastStatus = 422`, `ctx.lastBody = {type: 'urn:cordele:pub:metadata-incomplete'}`

Novo cenário `emAndamento=1`: step `project "proj-100" has the following publicacoes:` chama `seedPublicacoesFromDataTable`; step `the editor reads the publication stats` chama `GetPublicationStatsUseCase.execute`.

**Fase 8 — Verificação final**

Executar `pnpm test:bdd --runInBand` e confirmar exit 0 com todos os cenários verdes.

#### Política de testes

- Todos os steps são unit-level (sem DB, sem HTTP, sem NestJS TestingModule)
- Nenhum `test.skip` restante após esta prioridade
- `pnpm lint` deve passar — sem `console.log`, sem `any` implícito

#### Multi-empresa

Step `anAuthenticatedEditorOfEmpresaAetosWithScopePubW` deve setar `empresaId = 'emp_aetos'` no `EmpresaContextService` (AsyncLocalStorage) antes de cada cenário. Todos os use-cases chamados dentro do `empresaContextService.runAs('emp_aetos', ...)` enxergarão o tenant correto. O `InMemoryPublicacaoRepository` não aplica filtro de tenant (é in-memory por definição) — mas `findByPublicacaoId` e `findById` são chamados após o ALS ser setado, o que é suficiente para validar a invariante de isolamento.

#### Migrações Prisma

Nenhuma — BDD tests são purely in-memory.

#### Critérios de aceite

- `cd backend/services/pub-service && pnpm test:bdd` exits 0
- Saída Jest não contém `undefined step` nem `Skipped`
- DataTable `project {string} has the following publicacoes:` cria N linhas no `InMemoryPublicacaoRepository` com `status`/`epubcheckStatus` explícitos
- Cenário `emAndamento=1` passa: `GetPublicationStatsUseCase` retorna `emAndamento=1` com uma publicacao em `gerando`
- Step `epubcheck cannot execute` resulta em `PublicacaoEntity.status === 'com_erros'` (nunca `publicado`) — invariante ADR-003

#### Riscos

- `EpubcheckUnavailableError` pode não existir ainda em `src/domain/pub/` — verificar antes de implementar a Fase 5; criar se ausente (arquivo novo `src/domain/pub/errors/epubcheck-unavailable.error.ts`)
- `PublicacaoEntity` pode não ter construtor que aceite `status` explícito (só `iniciar()` hoje); se necessário, adicionar método estático `PublicacaoEntity.fromSnapshot(...)` no domain sem quebrar RULE-01/02
- Cucumber Expression `{string}` vs regex: usar `{string}` em todos os novos steps para evitar o pitfall `bdd-scaffold:cucumber-expression:escaped-quote-not-supported`

#### Instrução para implementador

Executar as 8 fases na ordem listada. Fase 1 é pré-requisito de todas as demais.
Não modificar `jest-bdd.json` — o runner já está correto.
O critério de aceite usa `pnpm test:bdd`, não `pnpm test test/pub/pub.bdd.spec.ts`
(o path `test/pub/` era pre-scaffold; o path real é `test/bdd/`).
Ao final de cada fase, verificar `pnpm lint` antes de prosseguir.

---

### Prioridade 9 -- Hardening
Status: DONE (2026-09-02 — runbook + findStaleInFlight + script pub-reconcile-orphans.ts entregues; todos [x] confirmados em PUB-020)

#### Issues vinculadas
- PUB-020 (runbook build órfão + script de reconciliação)

#### Specs cobertas
- SPEC-05 (idempotency §casos de borda — build órfão, reconciliação pós-POC)
- SPEC-02 (build-orchestration §casos de borda — crash durante build)

#### Objetivo

Documentar e operacionalizar o gap de reconciliação de build órfão identificado em M2/M3.
Um crash do processo durante o build (`gerando`/`validando`) deixa a linha `Publicacao`
presa em estado não-terminal, bloqueando futuros exports do mesmo projeto via o índice
parcial `uq_publicacao_projeto_inflight`. No MVP não existe timeout automático —
o operador deve agir manualmente. Esta prioridade entrega: (1) runbook, (2) método de
busca de órfãos no repositório, (3) script one-shot de reconciliação.

#### Problema identificado

1. `PublicacaoRepositoryPort` não expõe `findStaleInFlight` — operador não tem API de
   diagnóstico; o script de reconciliação precisaria de SQL direto sem type-safety.
2. Não existe runbook documentado — o operador não sabe como identificar, corrigir e
   verificar a liberação do índice parcial.
3. Não existe script de reconciliação — a correção hoje exigiria acesso direto ao banco
   com SQL manual, sem `--dry-run`, sem saída tabulada, sem auditoria.

#### Alvos de alteração (caminhos completos relativos ao repositório)

Novos arquivos a criar:
- `docs/architecture/backend/services/pub-service/runbook-orphan-build.md`
- `backend/services/pub-service/scripts/pub-reconcile-orphans.ts`

Arquivos a modificar:
- `backend/services/pub-service/src/domain/pub/ports/publicacao-repository.port.ts`
- `backend/services/pub-service/src/infrastructure/persistence/prisma-publicacao.repository.ts`
- `backend/services/pub-service/src/infrastructure/persistence/prisma-publicacao.repository.spec.ts`

#### Contrato operacional

Deve existir:
- `findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]>` na interface
  `PublicacaoRepositoryPort` (domain) e implementado em `PrismaPublicacaoRepository` (infra)
- `runbook-orphan-build.md` com as seções: Cenário, Critério de identificação, Passos de
  correção, Verificação da liberação do índice, Quando escalar
- `pub-reconcile-orphans.ts` com flag `--dry-run`; saída tabulada (`publicacaoId`, `projetoId`,
  `status`, `iniciadaEm`); sem execução automática

Não deve existir:
- Chamada a `findStaleInFlight` em nenhum controller, service ou use-case de produção
  (o método é diagnóstico/operacional — não exposto via REST)
- Import de `@prisma/client` em `domain/` (RULE-01)
- Timeout automático (escopo pós-POC — SPEC-05 §assunção pós-POC)

Verificação objetiva:
- `pnpm exec tsc --noEmit` em `backend/services/pub-service` exits 0 (novo método tipado)
- `pnpm lint` exits 0 (sem RULE-01/02 violation)
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0
- Teste unitário de `findStaleInFlight` passa em `prisma-publicacao.repository.spec.ts`
- `runbook-orphan-build.md` existe no path declarado e contém as 5 seções obrigatórias

Condição de bloqueio:
- Coluna `iniciadaEm` (snake_case: `iniciada_em`) deve existir em `prisma/schema.prisma`
  (criada em PUB-007); verificar antes de implementar a query Prisma

#### Sequência de execução

**Fase 1 — Extensão do port (domain)**

Arquivo: `src/domain/pub/ports/publicacao-repository.port.ts`

Acrescentar ao final da interface `PublicacaoRepositoryPort`, antes do `}`:

```ts
/**
 * Returns all publications stuck in a non-terminal state for longer than
 * `olderThanMinutes` minutes. Used exclusively by the reconciliation script
 * and the operational runbook — never exposed via REST.
 *
 * A publication is considered stale when:
 *   status IN ('gerando', 'validando')
 *   AND iniciadaEm < now() - interval '<olderThanMinutes> minutes'
 *
 * @param olderThanMinutes - threshold in minutes (typical: 60)
 */
findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]>;
```

Sem Nest decorators. Sem @prisma/client. RULE-01/02 OK.

**Fase 2 — Implementação na camada de infraestrutura**

Arquivo: `src/infrastructure/persistence/prisma-publicacao.repository.ts`

Acrescentar método `findStaleInFlight` à classe `PrismaPublicacaoRepository`:

```ts
async findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const models = await this.prisma.publicacao.findMany({
    where: {
      status: { in: [PublicacaoStatus.GERANDO, PublicacaoStatus.VALIDANDO] },
      iniciadaEm: { lt: cutoff },
    },
    orderBy: { iniciadaEm: 'asc' },
  });
  return PublicacaoMapper.toDomainList(models);
}
```

`iniciadaEm` é o campo Prisma correspondente à coluna `iniciada_em` (PUB-007).
O método ordena por `iniciadaEm ASC` para facilitar triagem no output do script.

**Fase 3 — Teste unitário**

Arquivo: `src/infrastructure/persistence/prisma-publicacao.repository.spec.ts`

Acrescentar bloco `describe('findStaleInFlight', ...)`:

- Cenário 1: publicacao com `status=gerando` e `iniciadaEm = 2h atrás` → retornada
- Cenário 2: publicacao com `status=gerando` e `iniciadaEm = 30min atrás` (threshold=60) → não retornada
- Cenário 3: publicacao com `status=publicado` e `iniciadaEm = 2h atrás` → não retornada (terminal)
- Cenário 4: lista vazia → retorna `[]`

Usar `jest.fn()` para `prisma.publicacao.findMany` (padrão já adotado no spec file).
Confirmar que `cutoff` é calculado corretamente (spy em `Date.now` ou injetar timestamp).

**Fase 4 — Runbook operacional**

Criar arquivo: `docs/architecture/backend/services/pub-service/runbook-orphan-build.md`

Estrutura obrigatória do runbook (5 seções — critério de aceite da issue):

```markdown
# Runbook: Reconciliação de Build Órfão (PUB-020)

## 1. Cenário de risco
[Descrever: crash do processo (OOM, restart do pod, SIGKILL) durante o build deixa
a publicação em status gerando/validando indefinidamente; o índice parcial
uq_publicacao_projeto_inflight bloqueia novos exports do mesmo projeto
enquanto a linha órfã existir]

## 2. Critério de identificação
Query de diagnóstico (tenant schema = emp_aetos):
```sql
SET search_path = emp_aetos;
SELECT id, projeto_id, status, iniciada_em
FROM publicacao
WHERE status IN ('gerando','validando')
  AND iniciada_em < now() - INTERVAL '1 hour';
```
Limiar padrão: 1 hora (configurável via PUB_ORPHAN_TIMEOUT_MINUTES).
Resultado não-vazio = build órfão confirmado.

## 3. Passos de correção
[Passo 1: dry-run para confirmar lista]
[Passo 2: executar script sem --dry-run para marcar com_erros]
[Passo 3: verificar liberação do índice (SELECT retorna 0 linhas)]
[Passo 4: informar o editor para tentar novo export via UI]

## 4. Verificação da liberação do índice
Após a correção, re-executar a query de diagnóstico e confirmar 0 linhas.
Confirmar também que o índice parcial não bloqueia novo export:
```sql
SELECT * FROM publicacao
WHERE projeto_id = '<projetoId>'
  AND status IN ('gerando','validando');
-- deve retornar 0 linhas
```

## 5. Quando escalar
[Se a query de diagnóstico retornar linhas após o script, ou se novas publicações
continuarem ficando presas após a correção → escalar para o time de plataforma]
```

O implementador deve preencher os blocos `[...]` com o conteúdo operacional descrito
acima — a estrutura de seções é obrigatória para satisfazer o critério de aceite da issue.

**Fase 5 — Script de reconciliação**

Criar arquivo: `backend/services/pub-service/scripts/pub-reconcile-orphans.ts`

O script é standalone (não importado pela aplicação), executado com `ts-node` ou
`npx tsx` diretamente pelo operador. Estrutura:

```ts
// Lê: DATABASE_URL (env obrigatório), PUB_ORPHAN_TIMEOUT_MINUTES (env, default 60)
// Argumento: --dry-run (flag opcional)
// Saída: tabela com publicacaoId / projetoId / status / iniciadaEm
// Sem --dry-run: atualiza status=com_erros, resumo_erro='Reconciled: process crash'

// Nota de multi-empresa: o script deve aceitar --schema <schema> (ex: emp_aetos)
// e executar SET search_path = <schema> antes de qualquer query.
// Default: emp_aetos (único tenant ativo no MVP).

// Estrutura principal:
// 1. parse args (--dry-run, --schema, --timeout-minutes)
// 2. new PrismaClient({ datasourceUrl: DATABASE_URL })
// 3. await prisma.$executeRawUnsafe(`SET search_path = ${schema}`)
// 4. findMany com where { status in gerando/validando, iniciada_em < cutoff }
// 5. imprimir tabela
// 6. se !dryRun: updateMany com { status: 'com_erros', resumo_erro: 'Reconciled: process crash' }
// 7. imprimir confirmação com count de linhas afetadas
// 8. prisma.$disconnect()
```

O implementador escolhe entre `process.argv` simples ou `minimist` para parsing de args.
Sem dependência em `src/` do serviço — o script é 100% standalone com `@prisma/client` direto
(exceção ao RULE-01: scripts/ não é `src/`, está fora do boundary `eslint-plugin-boundaries`).

**Fase 6 — Verificação final**

```bash
cd backend/services/pub-service
pnpm exec tsc --noEmit          # novo método tipado
pnpm lint                       # RULE-01/02 OK
pnpm test -- --testPathPattern="prisma-publicacao.repository.spec"
python scripts/arch-conformance.py check --layer be --target backend/services/pub-service
```

Confirmar que `runbook-orphan-build.md` existe em
`docs/architecture/backend/services/pub-service/`.

#### Política de testes

- Teste unitário de `findStaleInFlight` obrigatório em `prisma-publicacao.repository.spec.ts`
- Não é necessário teste de integração para o script (é one-shot operacional; o método
  `findStaleInFlight` já é coberto pela spec)
- `pnpm lint` deve passar — sem `console.log` em `src/` (o script pode usar `console.log`
  pois está em `scripts/`, fora da fronteira `eslint-plugin-boundaries`)

#### Multi-empresa

- O método `findStaleInFlight` não recebe `empresaId` — o isolamento já é feito via
  `search_path` pelo `EmpresaContextService` (AsyncLocalStorage), como em todos os outros
  métodos do repositório (ADR-003)
- O script standalone não passa pelo `EmpresaContextService`; deve aceitar `--schema <schema>`
  e executar `SET search_path` explicitamente antes das queries Prisma
- O runbook deve documentar que o operador deve especificar o schema correto (`emp_aetos`)

#### Migrações Prisma Migrate necessárias

Nenhuma — a coluna `iniciada_em` já existe (criada em PUB-007).
O campo Prisma `iniciadaEm` já está mapeado em `schema.prisma`.
Verificar o mapeamento antes de implementar a query na Fase 2.

#### Critérios de aceite

- `runbook-orphan-build.md` existe em `docs/architecture/backend/services/pub-service/`
  e contém as 5 seções obrigatórias (Cenário, Critério de identificação, Passos de correção,
  Verificação do índice, Quando escalar)
- `findStaleInFlight(60)` em teste unitário retorna publicações com `iniciadaEm > 1h atrás`
  em status `gerando` ou `validando`, e exclui publicações terminais e publicações recentes
- Script `pub-reconcile-orphans.ts` com `--dry-run` imprime a lista sem alterar nenhuma linha
  (verificado: SELECT após dry-run retorna as mesmas linhas)
- `pnpm exec tsc --noEmit` exits 0
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0

#### Riscos

- Campo `iniciadaEm` pode estar mapeado com nome diferente em `schema.prisma` (verificar
  antes da Fase 2; se diferente, ajustar o nome do campo na query Prisma)
- `scripts/` pode não ter `tsconfig.json` próprio — verificar se `npx tsx` resolve os tipos
  de `@prisma/client`; se necessário, usar `.sql` puro como alternativa (mesma lógica,
  sem dependência de runtime TypeScript)

#### Instrução para implementador

Executar as 6 fases na ordem. A Fase 1 (port) é pré-requisito da Fase 2 (infra).
Verificar o campo `iniciadaEm` em `prisma/schema.prisma` antes de escrever a query.
O runbook (Fase 4) é um arquivo Markdown operacional — não é código; preencher
os blocos `[...]` com o conteúdo descrito na estrutura. O script (Fase 5) não deve
ser importado por nenhum módulo da aplicação — é estritamente one-shot operacional.

---

### Prioridade 11 -- Corrigir regressão de INT-PUB-002 (testes e lint)
Status: DONE (2026-09-02 — test=PASS 143/143, lint=PASS, build=PASS, arch-conformance=OK 5/5)

#### Issues cobertas
- INT-PUB-002 (regressão introduzida durante implementação de P10)

#### Objetivo / Problema / Resultado esperado

Restaurar gates `test=PASS` e `lint=PASS` após a implementação do INT-PUB-002 (P10).
Os adapters HTTP (`CompCompositionMetadataAdapter`, `CompCompositionLayoutAdapter`) e o
wiring em `PubInfraBindingsModule` estão corretos e não devem ser revertidos.
Os dois problemas a corrigir são ortogonais: (1) asserções de teste desatualizadas e
(2) path do Prisma client gerado fora da lista de ignores do ESLint.

#### Problemas identificados

**Problema 1 — 2 falhas de teste em `generate-publication.use-case.spec.ts`**

O use-case chama `this.empresaContextRunner.runAs(empresaId, fn, bearerToken)` com
3 argumentos após INT-PUB-002 (o `bearerToken` é o terceiro argumento, adicionado para
propagar o token para os adapters HTTP de COMP dentro do job assíncrono).

As seguintes asserções do spec ainda esperam 2 argumentos e falham por exact matching do Jest:

- Linha 166: `expect(empresaContextRunner.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function))`
- Linha 249: `expect(runnerA.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function))`
- Linha 250: `expect(runnerB.runAs).toHaveBeenCalledWith('empresa-beta', expect.any(Function))`

**Problema 2 — Lint: Prisma client gerado não está na lista de ignores do ESLint**

O `schema.prisma` define `output = "../src/infrastructure/prisma-client"`, portanto o
Prisma client é gerado em `backend/services/pub-service/src/infrastructure/prisma-client/`.
Essa pasta não está na lista de ignores do `eslint.config.mjs` — o ESLint escaneia os
arquivos `.ts` gerados e reporta erros (tipos gerados pelo Prisma com patterns incompatíveis
com as regras `@typescript-eslint`). O `build=PASS` confirma que é um problema de ESLint, não
de compilação TypeScript.

#### Correcões mandatórias

**Correção 1 — Atualizar asserções no spec do use-case**

Arquivo: `backend/services/pub-service/src/modules/pub/use-cases/generate-publication.use-case.spec.ts`

Substituir as 3 asserções incompletas de `runAs`:

- Linha 166:
  ```ts
  // ANTES:
  expect(empresaContextRunner.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function));
  // DEPOIS:
  expect(empresaContextRunner.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function), expect.any(String));
  ```
- Linha 249:
  ```ts
  // ANTES:
  expect(runnerA.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function));
  // DEPOIS:
  expect(runnerA.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function), expect.any(String));
  ```
- Linha 250:
  ```ts
  // ANTES:
  expect(runnerB.runAs).toHaveBeenCalledWith('empresa-beta', expect.any(Function));
  // DEPOIS:
  expect(runnerB.runAs).toHaveBeenCalledWith('empresa-beta', expect.any(Function), expect.any(String));
  ```

Nota: o mock de `runAs` já usa `mockImplementation((_id: string, fn: () => unknown) => fn())`
que ignora o terceiro argumento — nenhuma mudança no mock é necessária.

**Correção 2 — Adicionar path do Prisma client gerado ao ESLint ignores**

Arquivo: `backend/services/pub-service/eslint.config.mjs`

Adicionar `'src/infrastructure/prisma-client/**'` ao array `ignores`:

```js
ignores: [
  'dist/**',
  'node_modules/**',
  'coverage/**',
  'coverage-e2e/**',
  'prisma/migrations/**',
  'src/infrastructure/prisma-client/**',  // Prisma client gerado — não é código autoral
  'eslint.config.mjs',
],
```

#### Alvos de alteração (caminhos completos relativos ao repositório)

Arquivos a modificar:
- `backend/services/pub-service/src/modules/pub/use-cases/generate-publication.use-case.spec.ts`
  — 3 asserções de `runAs` (linhas 166, 249, 250)
- `backend/services/pub-service/eslint.config.mjs`
  — adicionar `'src/infrastructure/prisma-client/**'` ao array `ignores`

#### Contrato operacional

Deve existir:
- `pnpm test -- --testPathPattern="generate-publication.use-case.spec"` exits 0 (0 falhas)
- `pnpm lint` exits 0 (0 lint errors)
- As 3 asserções de `runAs` no spec verificam os 3 argumentos: `(empresaId, Function, String)`

Não deve existir:
- Reversão dos adapters HTTP (`comp-composition-metadata.adapter.ts`, `comp-composition-layout.adapter.ts`)
- Reversão do wiring em `pub-infra-bindings.module.ts`
- Alteração na lógica de `runAs` (a assinatura com `bearerToken?` opcional permanece)

Verificação objetiva:
- `pnpm test -- --testPathPattern="generate-publication.use-case.spec"` → 5/5 testes passam
- `pnpm lint` exits 0
- `pnpm exec tsc --noEmit` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0

Condição de bloqueio:
- Se `pnpm lint` ainda reportar erros após as Fases 1 e 2, o implementador deve corrigir
  os erros residuais antes de marcar P11 como DONE.

#### Sequência de execução

**Fase 1 — Corrigir asserções no spec do use-case**

Editar `src/modules/pub/use-cases/generate-publication.use-case.spec.ts`:
- Linha 166: adicionar terceiro argumento `expect.any(String)` à asserção de `empresaContextRunner.runAs`
- Linha 249: idem para `runnerA.runAs`
- Linha 250: idem para `runnerB.runAs`
Verificar: `pnpm test -- --testPathPattern="generate-publication.use-case.spec" --runInBand` exits 0.

**Fase 2 — Adicionar Prisma client gerado à lista de ignores do ESLint**

Editar `eslint.config.mjs`: adicionar `'src/infrastructure/prisma-client/**'` ao array `ignores`.
Verificar: `pnpm lint` exits 0 (sem erros de lint em arquivos gerados pelo Prisma).

**Fase 3 — Verificar erros de lint residuais**

Executar `pnpm lint 2>&1` e corrigir qualquer erro restante que não seja coberto pelas
Fases 1 e 2 (improvável mas mandatório verificar).

**Fase 4 — Gate final completo**

```bash
cd backend/services/pub-service
pnpm test -- --testPathPattern="generate-publication.use-case.spec"
pnpm lint
pnpm exec tsc --noEmit
python scripts/arch-conformance.py check --layer be --target backend/services/pub-service
```

Todos devem retornar exit 0.

#### Política de testes

- Apenas atualização de asserções — nenhuma lógica de teste muda
- O mock de `runAs` não precisa ser alterado (o implementador aceita 2 args e ignora o terceiro)
- `pnpm lint` deve passar sem `--max-warnings` pendentes

#### Multi-empresa

Nenhuma alteração na lógica multi-empresa. A asserção atualizada reflete que `runAs`
agora propaga o `bearerToken` (terceiro argumento) para o ALS do job assíncrono, o que
é correto e esperado pelo INT-PUB-002.

#### Migrações Prisma Migrate necessárias

Nenhuma.

#### Critérios de aceite

- `pnpm test -- --testPathPattern="generate-publication.use-case.spec"` exits 0
- `pnpm lint` exits 0
- `pnpm exec tsc --noEmit` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0

#### Riscos

- Pode existir erros de lint residuais além do Prisma client se os novos adapters tiverem
  alguma violação de regra não detectada antes (improvável dado que `build=PASS` e as regras
  ESLint são simples). O implementador deve corrigir qualquer erro residual na Fase 3.

#### Instrução para implementador

Executar Fase 1 e Fase 2 de forma independente (são alterações em arquivos distintos).
Na Fase 4, confirmar que o gate completo passa antes de emitir DONE.
Não reverter nenhum dos adapters HTTP ou wiring do módulo — a implementação de INT-PUB-002
está correta; apenas as asserções de teste e o ignore do ESLint precisam de atualização.

---

### Prioridade 10 -- CompositionReadPort HTTP adapter real (INT-PUB-002)
Status: PARTIAL (adapters HTTP criados em infrastructure/http/; wiring em PubInfraBindingsModule; testes e lint introduzidos por esta implementação corrigidos em P11)

#### Issues cobertas
- INT-PUB-002 (CompositionReadPort adapter: HTTP client para comp-service)

#### Objetivo / Problema / Resultado esperado

Substituir os stubs `CompositionMetadataStub` e `CompositionLayoutStub` (PUB-012) pelos
adapters HTTP reais que chamam `GET /api/comp/projetos/{projetoId}/metadados` e
`GET /api/comp/projetos/{projetoId}/layout` no comp-service.

Ao concluir: score E2E sobe de 0/10 para valor mensuravel; `PublicationBuildJob` usa
metadados e layout reais de COMP em ambiente com `PUB_USE_STUBS=false`.

#### Problemas identificados

1. `EmpresaRequestContext` em `empresa-context.service.ts` armazena `userId` e `empresaId`
   no ALS, mas nao armazena o bearer token raw. Os adapters HTTP de COMP precisam do token
   para autenticar a chamada — sem ele resultam em 401.
2. `CompositionMetadataPort.get(projetoId)` e `CompositionLayoutPort.get(projetoId)` nao
   recebem `bearerToken` como parametro (diferente de `ManuscriptContentPort` e
   `AdvanceProjetoStatusPort`). Adicionar bearer token nas assinaturas quebraria 10+
   arquivos (stubs, use-cases, testes). Alternativa: obter o token do ALS via
   `EmpresaContextService.getBearerToken()`.
3. COMP retorna `materialized: false` quando nenhum dado real existe para o projeto
   (retorno de default sintetico, nao 404). O adapter de metadata deve tratar
   `materialized: false` como `null` para que o pre-flight de export rejeite com 422
   (api-contract §7.1 — titulo/autor/idioma ausentes).
4. COMP retorna `materialized: false` tambem para layout, mas `CompositionLayoutPort`
   aceita `null` com graceful fallback (EpubBuilder usa defaults COMP §7.2). Portanto o
   adapter de layout deve igualmente retornar `null` quando `materialized: false`.

#### Correcoes mandatorias

1. Estender `EmpresaRequestContext` com campo opcional `bearerToken?: string`.
2. Adicionar metodo `getBearerToken(): string | null` em `EmpresaContextService`.
3. Atualizar `EmpresaContextMiddleware` para armazenar o token raw no contexto ALS.
4. Criar `CompCompositionMetadataAdapter` em `infrastructure/http/`.
5. Criar `CompCompositionLayoutAdapter` em `infrastructure/http/`.
6. Registrar os dois adapters em `PubInfraBindingsModule` sob os tokens
   `COMPOSITION_METADATA_PORT` e `COMPOSITION_LAYOUT_PORT` quando `PUB_USE_STUBS != true`.
7. Adicionar `COMP_SERVICE_URL` ao `.env.example` (ou equivalente documentado).

#### Alvos de alteracao (caminhos completos relativos ao repositorio)

Arquivos a modificar:
- `backend/services/pub-service/src/infrastructure/auth/empresa-context.service.ts`
  — estender `EmpresaRequestContext` com `bearerToken?: string`; adicionar `getBearerToken(): string | null`
- `backend/services/pub-service/src/infrastructure/auth/empresa-context.middleware.ts`
  — incluir `bearerToken: token` na chamada `this.empresaContextService.run({ userId, empresaId, bearerToken: token }, ...)`
- `backend/services/pub-service/src/infrastructure/pub/pub-infra-bindings.module.ts`
  — adicionar `CompCompositionMetadataAdapter` e `CompCompositionLayoutAdapter` ao array condicional
- `backend/services/pub-service/docs/architecture/backend/issues/INT-PUB-002.md`
  — atualizar status para IN-PROGRESS

Novos arquivos a criar:
- `backend/services/pub-service/src/infrastructure/http/comp-composition-metadata.adapter.ts`
- `backend/services/pub-service/src/infrastructure/http/comp-composition-metadata.adapter.spec.ts`
- `backend/services/pub-service/src/infrastructure/http/comp-composition-layout.adapter.ts`
- `backend/services/pub-service/src/infrastructure/http/comp-composition-layout.adapter.spec.ts`

#### Contrato operacional

Deve existir:
- `EmpresaContextService.getBearerToken()` retornando o bearer token do contexto ALS corrente, ou `null` se nao ha contexto (rotas publicas, jobs asincronos sem contexto HTTP)
- `CompCompositionMetadataAdapter implements CompositionMetadataPort`:
  - `get(projetoId)` → `GET ${COMP_SERVICE_URL}/api/comp/projetos/{projetoId}/metadados`
  - `Authorization: Bearer <token>` obtido via `getBearerToken()`
  - HTTP 200 + `materialized: true` → mapear para `MetadadosRead` (ignorar campo `materialized`)
  - HTTP 200 + `materialized: false` → retornar `null`
  - HTTP 404 → retornar `null`
  - Erro de rede → logar + retornar `null` (nunca lancar excecao que interrompa o build job)
- `CompCompositionLayoutAdapter implements CompositionLayoutPort`:
  - `get(projetoId)` → `GET ${COMP_SERVICE_URL}/api/comp/projetos/{projetoId}/layout`
  - `Authorization: Bearer <token>` obtido via `getBearerToken()`
  - HTTP 200 + `materialized: true` → mapear para `LayoutRead` (filtrar `overrides` onde `tipo === 'imagem'` ou `'em-branco'`, manter campos do port)
  - HTTP 200 + `materialized: false` → retornar `null`
  - HTTP 404 → retornar `null`
  - Erro de rede → logar + retornar `null`
- Em `PubInfraBindingsModule`: quando `!useStubs`, adicionar:
  ```
  { provide: COMPOSITION_METADATA_PORT, useClass: CompCompositionMetadataAdapter },
  { provide: COMPOSITION_LAYOUT_PORT, useClass: CompCompositionLayoutAdapter },
  ```
  e exportar ambos os tokens no array `exports`.

Nao deve existir:
- Import direto de qualquer tipo de `comp-service/src/` dentro de `pub-service/src/`
- Bearer token hardcoded ou obtido de variavel de ambiente (somente via ALS)
- `console.log` em qualquer adapter (RULE-08 — usar Nest Logger)
- Chamada HTTP que propaga erros de rede como excecao para o caller (sempre absorver com log + null)

Verificacao objetiva:
- `pnpm test -- --testPathPattern="comp-composition"` exits 0 (2 spec files)
- `pnpm exec tsc --noEmit` exits 0
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0

Condicao de bloqueio:
- `COMPOSITION_METADATA_PORT` e `COMPOSITION_LAYOUT_PORT` devem existir em `pub.tokens.ts`
  como tokens DI antes de registrar os adapters; verificar antes da Fase 4.

#### Sequencia de execucao

**Fase 1 — Extensao do EmpresaContextService (auth)**

Arquivo: `src/infrastructure/auth/empresa-context.service.ts`

Modificar a interface `EmpresaRequestContext`:
```ts
interface EmpresaRequestContext {
  readonly userId: string;
  readonly empresaId: string;
  readonly bearerToken?: string;  // <-- adicionar
}
```

Adicionar metodo publico `getBearerToken()` apos `runAs`:
```ts
getBearerToken(): string | null {
  return this.als.getStore()?.bearerToken ?? null;
}
```

**Fase 2 — Atualizar EmpresaContextMiddleware**

Arquivo: `src/infrastructure/auth/empresa-context.middleware.ts`

Na linha onde `run()` e chamado, adicionar `bearerToken: token` ao objeto de contexto:
```ts
this.empresaContextService.run({ userId, empresaId, bearerToken: token }, () => next());
```

O `token` ja esta disponivel na variavel local (extraido do header `Authorization`).

**Fase 3 — Criar CompCompositionMetadataAdapter**

Arquivo: `src/infrastructure/http/comp-composition-metadata.adapter.ts`

```ts
@Injectable()
export class CompCompositionMetadataAdapter implements CompositionMetadataPort {
  private readonly logger = new Logger(CompCompositionMetadataAdapter.name);
  private readonly compBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly empresaContext: EmpresaContextService,
  ) {
    this.compBaseUrl = config.get<string>('COMP_SERVICE_URL') ?? 'http://localhost:3003';
  }

  async get(projetoId: string): Promise<MetadadosRead | null> { ... }
}
```

Regras de mapeamento da resposta HTTP de COMP para `MetadadosRead` (port do PUB):
- Campo `materialized: false` → retornar `null` (sem dados reais)
- Campo `titulo`, `autor`, `idioma`, `isbn`, `categoria`, `capaUrl`, `editoraNome` → mapear diretamente; coercer para `null` se string vazia
- Campo `atualizadoEm` → mapear para string ISO (o port define `atualizadoEm: string`)
- Ignorar campo `materialized` no objeto retornado
- COMP retorna `200` com `materialized: false` quando nenhuma composicao foi salva; tratar como null

**Fase 4 — Criar CompCompositionLayoutAdapter**

Arquivo: `src/infrastructure/http/comp-composition-layout.adapter.ts`

Regras de mapeamento da resposta HTTP de COMP para `LayoutRead` (port do PUB):
- Campo `materialized: false` → retornar `null`
- Campos tipograficos (`fonteCorpoFamilia`, `fonteCorpoTamanho`, `espacamentoLinha`, `margemLateral`, `h1Tamanho`, `h2Tamanho`, `h3Tamanho`) → mapear diretamente
- Campo `overrides` → filtrar apenas items com `tipo === 'imagem'` ou `'em-branco'`; mapear para `LayoutOverrideRead` do port
- Ignorar campo `atualizadoEm` (nao existe em `LayoutRead` do port)
- Ignorar campo `materialized` e qualquer campo extra

**Fase 5 — Criar specs dos adapters**

Arquivo: `src/infrastructure/http/comp-composition-metadata.adapter.spec.ts`

Cenarios de teste (unit — sem HTTP real, fetch mockado):
- Cenario 1: `200` com `materialized: true` e todos os campos → retorna `MetadadosRead` mapeado
- Cenario 2: `200` com `materialized: false` → retorna `null`
- Cenario 3: `404` → retorna `null`
- Cenario 4: erro de rede (`fetch` rejeita) → retorna `null` (sem excecao propagada)
- Cenario 5: bearer token `null` (sem contexto ALS) → chama fetch sem header `Authorization`; retorna `null` se COMP retornar 401

Arquivo: `src/infrastructure/http/comp-composition-layout.adapter.spec.ts`

Cenarios de teste:
- Cenario 1: `200` com `materialized: true` e overrides → retorna `LayoutRead` com overrides filtrados
- Cenario 2: `200` com `materialized: false` → retorna `null`
- Cenario 3: `404` → retorna `null`
- Cenario 4: erro de rede → retorna `null`

**Fase 6 — Registrar adapters em PubInfraBindingsModule**

Arquivo: `src/infrastructure/pub/pub-infra-bindings.module.ts`

No array `httpAdapterProviders` (condicional `!useStubs`), adicionar:
```ts
{ provide: COMPOSITION_METADATA_PORT, useClass: CompCompositionMetadataAdapter },
{ provide: COMPOSITION_LAYOUT_PORT, useClass: CompCompositionLayoutAdapter },
```

Adicionar os dois tokens ao array `exports` da secao `!useStubs`.

Verificar que `COMPOSITION_METADATA_PORT` e `COMPOSITION_LAYOUT_PORT` existem em
`src/modules/pub/pub.tokens.ts` (devem existir desde P2/PUB-012). Se nao existirem,
criar antes desta fase.

**Fase 7 — Verificacao final**

```bash
cd backend/services/pub-service
pnpm exec tsc --noEmit
pnpm lint
pnpm test -- --testPathPattern="comp-composition"
pnpm test -- --testPathPattern="empresa-context"   # verificar que extensao nao quebrou testes existentes
python scripts/arch-conformance.py check --layer be --target backend/services/pub-service
```

#### Politica de testes

- Unit tests obrigatorios para ambos os adapters (fetch mockado — `jest.spyOn(globalThis, 'fetch')`)
- Nao ha teste de integracao (sem DB; HTTP mockado no unit test e suficiente)
- Verificar que os testes de `empresa-context.service.spec.ts` (se existirem) continuam passando apos a extensao do ALS store
- `pnpm lint` deve passar — sem `any` implicito, sem `console.log`

#### Multi-empresa

- O bearer token no ALS representa o usuario autenticado da requisicao HTTP original, que ja passou pelo `JwtAuthGuard` e tem `empresa_id` validado
- Os adapters nao precisam propagar `empresa_id` explicitamente: o COMP service recebe o mesmo JWT Bearer e extrai o schema via seu proprio middleware
- No job assincrono (`PublicationBuildJob`), o contexto ALS e propagado via `empresaContextService.runAs(empresaId, ...)` (P5/INT-PUB-006) — mas **nao inclui bearer token** (nao ha request HTTP no job). Os adapters de COMP, quando chamados dentro do job, receberao `getBearerToken() === null`. O implementador deve:
  - Verificar que `PublicationBuildJobInput` inclui o `bearerToken` capturado antes do `Promise.resolve()` (analogo ao `empresaId`)
  - Passar o token como campo do input do job e usa-lo explicitamente ao chamar os adapters de COMP
  - Alternativa: estender `runAs(empresaId, bearerToken, fn)` para incluir bearer token no ALS do job

  **Decisao do planner:** usar a alternativa — estender `runAs` para aceitar `bearerToken?: string` opcional:
  ```ts
  runAs<T>(empresaId: string, fn: () => T, bearerToken?: string): T {
    return this.als.run({ userId: '', empresaId, bearerToken }, fn);
  }
  ```
  E em `PublicationBuildJob`, capturar o bearer token antes do `Promise.resolve()` e passa-lo para `runAs`.

  Arquivos adicionais afetados por esta decisao:
  - `src/infrastructure/auth/empresa-context.service.ts` — extensao de `runAs` (ja na Fase 1)
  - `src/modules/pub/application/publication-build.job.ts` — capturar e propagar bearer token
  - `src/modules/pub/application/publication-build.job.spec.ts` — atualizar mock de `runAs`

#### Migracoes Prisma Migrate necessarias

Nenhuma. Esta prioridade e puramente de infraestrutura HTTP e nao toca o schema DB.

#### Criterios de aceite

- `pnpm test -- --testPathPattern="comp-composition"` exits 0 (cenarios de metadata e layout)
- `pnpm exec tsc --noEmit` exits 0
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0
- Com `PUB_USE_STUBS=false` e `COMP_SERVICE_URL` apontando para comp-service real: `POST /api/pub/projetos/{id}/export` usa metadados e layout reais (verificavel via log `CompCompositionMetadataAdapter`)
- `EmpresaContextService.getBearerToken()` retorna o token do contexto corrente; retorna `null` fora de contexto HTTP

#### Riscos

- `bearerToken` pode ser `null` no job assincrono se `runAs` nao for estendido: COMP retornaria 401 e o adapter retornaria `null`, causando 422 `metadata-incomplete` mesmo com dados reais. Mitigacao: extensao de `runAs` obrigatoria antes do adapter.
- COMP `GET /metadados` pode retornar `200` com `materialized: false` (default sintetico) ao inves de `404` quando o projeto nao tem dados reais. O adapter deve checar o campo `materialized`, nao apenas o status HTTP.
- `COMP_SERVICE_URL` ausente em `.env.local`: o adapter usa `http://localhost:3003` como default — documentar no `.env.example`.

#### Instrucao para implementador

Executar as 7 fases na ordem. Fase 1 e pre-requisito de Fase 2, 3, 4 e da extensao do job.
Verificar antes da Fase 6 que `COMPOSITION_METADATA_PORT` e `COMPOSITION_LAYOUT_PORT` existem
em `pub.tokens.ts`; se ausentes, criar como `export const COMPOSITION_METADATA_PORT = Symbol(...)`.
Nao alterar assinaturas de `CompositionMetadataPort.get()` nem `CompositionLayoutPort.get()` —
o bearer token e obtido via `EmpresaContextService.getBearerToken()` internamente.
A extensao de `runAs` na Fase 1 deve manter retrocompatibilidade: o parametro `bearerToken`
e opcional; chamadas existentes sem o terceiro argumento continuam funcionando.

---

### Prioridade 12 -- Reconciliar checklist das issues implementadas
Status: pendente

#### Issues cobertas
PUB-002, PUB-003, PUB-004, PUB-005, PUB-006, PUB-007, PUB-008, PUB-013, PUB-014, PUB-015,
PUB-017, PUB-018, INT-PUB-001, INT-PUB-002, INT-PUB-003, INT-PUB-004, INT-PUB-005, INT-PUB-006

#### Objetivo / Problema / Resultado esperado

O BASELINE de 2026-09-03 marcou score 68/100 com 78/177 itens done. O código das issues P2..P8
foi implementado em sessões anteriores mas `validator-score.py mark` nunca foi executado para
essas issues, deixando os arquivos de issue com `[ ]` mesmo com código presente. Esta prioridade
verifica o código existente contra cada checklist, atualiza os caminhos divergentes nos arquivos
de issue e executa o mark para cada issue verificada. Ao final o score deve refletir o estado
real do código (expectativa: >= 85/100, possivelmente 90+).

#### Problemas identificados

1. Issue files reportam "INTACT / 0/N done" para issues com código funcional nos caminhos:
   - PUB-005: issue especifica `src/modules/pub/application/` mas código está em `src/modules/pub/use-cases/`
   - PUB-008: issue especifica `src/infrastructure/pub/persistence/publicacao.repository.ts`
     mas código está em `src/infrastructure/persistence/prisma-publicacao.repository.ts`
   - PUB-013: issue especifica `src/modules/pub/auth/` mas guard está em `src/infrastructure/auth/`
   - PUB-018: issue especifica `src/modules/pub/health/` mas indicador está em `src/infrastructure/pub/health/` (coincide)
2. `validator-score.py mark` nunca executado para essas issues.
3. Score 68 vs score real estimado >= 85 — discrepância de ~17 pontos por falta de mark.

#### Correcoes mandatorias

Para cada issue listada acima, em sequência:
1. Verificar que o arquivo esperado existe (no path real do código, não o path da issue).
2. Se o código existe e implementa o critério de aceite: atualizar o item de checklist no arquivo
   de issue de `[ ]` para `[x]`, ajustando o path se divergiu do spec original.
3. Executar `python scripts/validator-score.py mark --issue <MODULO>-NNN --layer be --done` após
   confirmar que todos os itens da issue estão verificados.
4. Ao final de todas as issues: executar o gate completo para confirmar que nenhuma regressão foi
   introduzida pelos arquivos de issue editados.

**Ordem de execução das issues (menor dependência primeiro):**
PUB-002 → PUB-003 → PUB-004 → PUB-006 → PUB-007 → PUB-008 → PUB-005 →
PUB-013 → PUB-017 → PUB-018 → PUB-014 → PUB-015 →
INT-PUB-001 → INT-PUB-003 → INT-PUB-004 → INT-PUB-005 → INT-PUB-006 → INT-PUB-002

#### Alvos de alteracao (caminhos completos relativos ao repositorio)

Arquivos de issue a atualizar (checklist items [ ] → [x] e paths divergentes corrigidos):
- `docs/architecture/backend/issues/PUB-002.md`
- `docs/architecture/backend/issues/PUB-003.md`
- `docs/architecture/backend/issues/PUB-004.md`
- `docs/architecture/backend/issues/PUB-005.md`
- `docs/architecture/backend/issues/PUB-006.md`
- `docs/architecture/backend/issues/PUB-007.md`
- `docs/architecture/backend/issues/PUB-008.md`
- `docs/architecture/backend/issues/PUB-013.md`
- `docs/architecture/backend/issues/PUB-014.md`
- `docs/architecture/backend/issues/PUB-015.md`
- `docs/architecture/backend/issues/PUB-017.md`
- `docs/architecture/backend/issues/PUB-018.md`
- `docs/architecture/backend/issues/INT-PUB-001.md` (se existir)
- `docs/architecture/backend/issues/INT-PUB-002.md` (se existir)
- `docs/architecture/backend/issues/INT-PUB-003.md` (se existir)
- `docs/architecture/backend/issues/INT-PUB-004.md` (se existir)
- `docs/architecture/backend/issues/INT-PUB-005.md` (se existir)
- `docs/architecture/backend/issues/INT-PUB-006.md` (se existir)

Nenhum arquivo de código deve ser criado ou modificado nesta prioridade.

#### Contrato operacional

Deve existir ao final:
- Todos os arquivos de issue listados com `Done/Total: N/N` (todos os itens verificados marcados [x])
- `validator-score.py mark` executado com sucesso para cada issue verificada
- Score PUB >= 85/100 após reconciliação (a ser confirmado pelo validator)
- Gates test=PASS build=PASS lint=PASS arch-conformance=PASS — inalterados (nenhum código editado)

Nao deve existir:
- Nenhum `[ ]` em issue que tem código funcional verificado
- Edição de código de produção ou de testes nesta prioridade

Verificacao objetiva:
- `python scripts/validator-score.py summary --module PUB --layer be` mostra score >= 85
- `pnpm test` exits 0 com 161+ passing (nenhuma regressão)
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0

Condicao de bloqueio:
- Se um item de checklist de issue não tiver código correspondente funcional, NÃO marcar como done
  — documentar o gap real no arquivo de issue e reportar ao planner antes de prosseguir.

#### Sequencia de execucao

**Fase 1 — Verificar e marcar PUB-002..PUB-008 (domain + use-cases + persistence)**

Para cada issue PUB-002, PUB-003, PUB-004, PUB-006, PUB-007, PUB-008, PUB-005:
- Localizar o arquivo de código real (pode divergir do path na issue)
- Verificar que o código implementa o critério de aceite do item
- Editar o arquivo de issue: corrigir path se divergiu, marcar `[x]`
- Executar `python scripts/validator-score.py mark --issue PUB-NNN --layer be --done`

**Fase 2 — Verificar e marcar PUB-013, PUB-017, PUB-018 (auth, observability, health)**

Mesma lógica da Fase 1 para PUB-013, PUB-017, PUB-018.

**Fase 3 — Verificar e marcar PUB-014, PUB-015 (ports exportadas)**

Verificar `publication-history.service.ts` e `publication-erasure.service.ts` contra critérios de PUB-014 e PUB-015.

**Fase 4 — Verificar e marcar INT-PUB-001..006**

Verificar os adapters HTTP e wiring contra critérios das issues de integração.

**Fase 5 — Gate final**

```bash
cd backend/services/pub-service
pnpm test
pnpm lint
pnpm exec tsc --noEmit
python scripts/arch-conformance.py check --layer be --target backend/services/pub-service
python scripts/validator-score.py summary --module PUB --layer be
```

#### Politica de testes

Nenhum teste novo a escrever nesta prioridade. Verificar apenas que os testes existentes continuam passando.

#### Multi-empresa

Nenhuma alteração de código. O `EmpresaContext` propagado via ALS já está implementado e funcional.

#### Migracoes Prisma Migrate necessarias

Nenhuma nesta prioridade.

#### Criterios de aceite

- `python scripts/validator-score.py summary --module PUB --layer be` mostra score >= 85/100
- `pnpm test` exits 0 (161+ passing, nenhuma regressão)
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0
- Todos os arquivos de issue verificados têm `Done/Total: N/N` com todos itens `[x]`

#### Riscos

- Divergência de path entre issue spec e código real pode indicar que o código existe mas numa
  localização que não atende ao padrão hexagonal (RULE-01..09). Nesse caso: não marcar done sem
  revisar se a localização é aceitável arquiteturalmente.
- Alguns itens de checklist podem cobrir critérios que o código satisfaz apenas parcialmente
  (ex.: spec pede retry em colisão de unique constraint; código pode ter implementado sem o retry).
  Verificar cada critério de aceite antes de marcar [x].

#### Instrucao para implementador

Executar as fases em ordem. Não alterar código de produção — apenas os arquivos `.md` de issue.
Para cada item de checklist: verificar primeiro que o arquivo de código existe com `cat` ou `ls`;
se o arquivo existe, verificar que implementa o critério (ler o arquivo); só então marcar `[x]`.
Se um critério não está implementado, deixar `[ ]` e registrar na issue com comentário.
Executar o gate da Fase 5 antes de emitir DONE.

---

### Prioridade 13 -- Implementar campos EpubSummaryVM (PUB-021 / ADR-004)
Status: pendente

#### Issues cobertas
- PUB-021 (campos tamanho_bytes, total_capitulos, total_imagens — ADR-004)

#### Objetivo / Problema / Resultado esperado

ADR-004 foi decidido em 2026-09-01 e o contrato (api-contract §6.1, data-model.md §2.1) já foi
emendado. O código ainda não implementa os 3 campos: o modelo Prisma não tem as colunas, o
`EpubBuilder` não conta capítulos/imagens, o `DiskFileStorageAdapter` não retorna o byte size,
o `PublicationBuildJob` não persiste esses valores e os DTOs não os expõem.

Ao concluir: `GET /api/pub/projetos/{id}/status` retorna `tamanhoBytes`, `totalCapitulos`,
`totalImagens` para publicações com `status=publicado`; campos nulos para builds em andamento ou
com erros. FE (INT-FE-PUB-005) desbloqueado para consumir os tiles do `EpubSummaryGridComponent`.

#### Problemas identificados

1. `Publicacao` no schema Prisma não tem colunas `tamanho_bytes` (Int?), `total_capitulos` (Int?),
   `total_imagens` (Int?).
2. `EpubBuilder.build()` não conta capítulos nem imagens durante o walk de `ManuscriptContentPort`.
3. `FileStoragePort.store()` não retorna o byte size do arquivo escrito.
4. `PublicationBuildJob` não persiste os 3 campos após o build bem-sucedido.
5. `PublicacaoStatusDto` e `PublicacaoHistoryItemDto` não têm os campos novos.

#### Correcoes mandatorias

1. Adicionar 3 colunas ao `schema.prisma`: `tamanho_bytes Int? @map("tamanho_bytes")`,
   `total_capitulos Int? @map("total_capitulos")`, `total_imagens Int? @map("total_imagens")`.
2. Gerar migration Prisma: `pnpm prisma migrate dev --name add-epub-summary-kpi-fields`.
3. Extender `EpubBuilder.build()` para retornar `{ epubBytes: Buffer; totalCapitulos: number; totalImagens: number }`.
4. Extender `FileStoragePort.store(ref, buffer)` → `{ bytesWritten: number }` no retorno; atualizar
   `DiskFileStorageAdapter` e os stubs.
5. Atualizar `PublicationBuildJob` para capturar e persistir os 3 valores via `publicacaoRepository.update(...)`.
6. Atualizar `PublicacaoEntity` com os 3 campos opcionais.
7. Atualizar `PublicacaoStatusDto` com `tamanhoBytes?: number`, `totalCapitulos?: number`, `totalImagens?: number`.
8. Atualizar `publicacao.mapper.ts` para mapear as 3 colunas novas.

#### Alvos de alteracao (caminhos completos relativos ao repositorio)

Arquivos a modificar:
- `backend/services/pub-service/prisma/schema.prisma` — adicionar 3 colunas ao model `Publicacao`
- `backend/services/pub-service/src/domain/pub/publicacao.entity.ts` — adicionar 3 campos opcionais
- `backend/services/pub-service/src/domain/pub/epub-builder.ts` — retornar contagens de capítulos e imagens
- `backend/services/pub-service/src/domain/pub/epub-builder.spec.ts` — atualizar specs para asserção dos campos novos
- `backend/services/pub-service/src/modules/pub/ports/file-storage.port.ts` — extender retorno de `store()` com `bytesWritten`
- `backend/services/pub-service/src/infrastructure/pub/storage/disk-file-storage.adapter.ts` — implementar retorno de `bytesWritten`
- `backend/services/pub-service/src/infrastructure/pub/storage/disk-file-storage.adapter.spec.ts` — asserção de bytesWritten
- `backend/services/pub-service/src/modules/pub/use-cases/publication-build.job.ts` — capturar e persistir os 3 campos
- `backend/services/pub-service/src/modules/pub/use-cases/publication-build.job.spec.ts` — asserção dos 3 campos persistidos
- `backend/services/pub-service/src/infrastructure/persistence/publicacao.mapper.ts` — mapear 3 colunas novas
- `backend/services/pub-service/src/modules/pub/dto/publicacao-status.dto.ts` — adicionar 3 campos opcionais ao DTO
- `backend/services/pub-service/src/infrastructure/pub/stubs/manuscript-content.stub.ts` — se afetado pela mudança de EpubBuilder

Novos arquivos a criar:
- `backend/services/pub-service/prisma/migrations/<timestamp>_add_epub_summary_kpi_fields/migration.sql`
  (gerado automaticamente por `pnpm prisma migrate dev`)

#### Contrato operacional

Deve existir:
- Colunas `tamanho_bytes`, `total_capitulos`, `total_imagens` em `publicacao` (verificável via `\d publicacao` no psql ou via schema.prisma)
- `EpubBuilder.build()` retorna objeto com `epubBytes`, `totalCapitulos`, `totalImagens`
- `FileStoragePort.store()` retorna `{ bytesWritten: number }` (ou campo equivalente)
- `PublicacaoStatusDto.tamanhoBytes`, `.totalCapitulos`, `.totalImagens` presentes quando `status=publicado`; `null` caso contrário
- `PublicationBuildJob` persiste os 3 valores no `update()` final

Nao deve existir:
- Import de `@prisma/client` em qualquer arquivo de `domain/` (RULE-01)
- Campo `totalPaginas` em qualquer DTO ou coluna no schema (decidido em ADR-004: omitido permanentemente)
- Campo em `PublicacaoHistoryItemDto` (ADR-004 §D-S: apenas `PublicacaoStatus` recebe os campos)

Verificacao objetiva:
- `pnpm prisma migrate dev` exits 0
- `pnpm test` exits 0
- `pnpm lint` exits 0
- `pnpm exec tsc --noEmit` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0
- `GET /api/pub/projetos/{id}/status` com publicação `status=publicado` inclui `tamanhoBytes` (number), `totalCapitulos` (number), `totalImagens` (number) no body

Condicao de bloqueio:
- P12 deve estar DONE antes de iniciar P13 (score reconciliado garante que qualquer regressão de P13 seja detectável imediatamente)

#### Sequencia de execucao

**Fase 1 — Schema Prisma + migration**

Editar `schema.prisma`: adicionar ao model `Publicacao`:
```prisma
tamanhoBytes     Int?   @map("tamanho_bytes")
totalCapitulos   Int?   @map("total_capitulos")
totalImagens     Int?   @map("total_imagens")
```
Executar: `cd backend/services/pub-service && pnpm prisma migrate dev --name add-epub-summary-kpi-fields`

**Fase 2 — Domain entity + EpubBuilder**

Arquivo `publicacao.entity.ts`: adicionar `tamanhoBytes?: number`, `totalCapitulos?: number`,
`totalImagens?: number` (nulos por default; não-nulos apenas quando `status=publicado`).

Arquivo `epub-builder.ts`: durante o walk de `ManuscriptContentPort.getContent()`, contar:
- `totalCapitulos`: número de capítulos processados (items com `tipo === 'capitulo'` ou equivalente)
- `totalImagens`: número de imagens referenciadas (items com `tipo === 'imagem'`)

Retornar `{ epubBytes: Buffer; totalCapitulos: number; totalImagens: number }` em vez de apenas `Buffer`.

**Fase 3 — FileStoragePort + DiskAdapter**

Interface `file-storage.port.ts`: alterar assinatura `store(ref: string, data: Buffer): Promise<void>`
para `store(ref: string, data: Buffer): Promise<{ bytesWritten: number }>`.

Implementar em `disk-file-storage.adapter.ts`: após `fs.writeFile(...)`, retornar
`{ bytesWritten: data.byteLength }`.

Atualizar stub de FileStorage se usado em testes.

**Fase 4 — PublicationBuildJob**

Capturar os valores retornados pelo `EpubBuilder.build()` e pelo `FileStoragePort.store()`.
No `update()` final que grava o desfecho `publicado`, incluir:
```ts
tamanhoBytes: storeResult.bytesWritten,
totalCapitulos: buildResult.totalCapitulos,
totalImagens: buildResult.totalImagens,
```

**Fase 5 — Mapper + DTO**

`publicacao.mapper.ts`: mapear `tamanho_bytes → tamanhoBytes`, `total_capitulos → totalCapitulos`,
`total_imagens → totalImagens` nos dois sentidos (Prisma ↔ Entity).

`publicacao-status.dto.ts`: adicionar campos:
```ts
tamanhoBytes?: number;
totalCapitulos?: number;
totalImagens?: number;
```

**Fase 6 — Specs e gate final**

Atualizar `epub-builder.spec.ts` e `publication-build.job.spec.ts` para assertar os 3 campos.
Executar gate completo:
```bash
cd backend/services/pub-service
pnpm test
pnpm lint
pnpm exec tsc --noEmit
python scripts/arch-conformance.py check --layer be --target backend/services/pub-service
```

#### Politica de testes

- Unit tests obrigatórios para `EpubBuilder` (asserção de `totalCapitulos` e `totalImagens`)
- Unit test obrigatório para `PublicationBuildJob` (asserção de que `update()` recebe os 3 campos)
- Unit test para `DiskFileStorageAdapter` (asserção de `bytesWritten`)
- Integration test NÃO necessário (sem DB real no CI)

#### Multi-empresa

Os 3 campos são dados de build — calculados no job assíncrono que já propaga `EmpresaContext`
via `runAs(empresaId, fn, bearerToken)`. Nenhuma alteração de propagação de tenant necessária.

#### Migracoes Prisma Migrate necessarias

Sim — 1 migration: `add-epub-summary-kpi-fields`.
Arquivo gerado em: `backend/services/pub-service/prisma/migrations/<timestamp>_add_epub_summary_kpi_fields/migration.sql`

Conteúdo esperado da migration:
```sql
ALTER TABLE "publicacao" ADD COLUMN "tamanho_bytes" INTEGER;
ALTER TABLE "publicacao" ADD COLUMN "total_capitulos" INTEGER;
ALTER TABLE "publicacao" ADD COLUMN "total_imagens" INTEGER;
```

#### Criterios de aceite

- `pnpm prisma migrate dev --name add-epub-summary-kpi-fields` exits 0
- `pnpm test` exits 0 (todos os testes existentes + novos para os 3 campos)
- `pnpm lint` exits 0
- `pnpm exec tsc --noEmit` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0
- `PublicacaoStatusDto` tem `tamanhoBytes`, `totalCapitulos`, `totalImagens` (verificável via tsc ou grep no DTO)
- `PublicacaoHistoryItemDto` NÃO tem os 3 campos (ADR-004 §D-S)
- `domain/pub/publicacao.entity.ts` NÃO importa `@prisma/client` (RULE-01)

#### Riscos

- `FileStoragePort.store()` é chamada em múltiplos lugares (build job, testes, stubs). Alterar
  o retorno de `void` para `{ bytesWritten }` requer atualização de todos os callers e mocks.
  Verificar via `grep -rn "\.store(" src/` antes de alterar a assinatura.
- `EpubBuilder.build()` retorna apenas `Buffer` hoje; a mudança para retornar objeto composto
  requer atualizar todos os callers (PublicationBuildJob e specs). Verificar via grep antes de alterar.
- A contagem de capítulos/imagens depende do formato retornado por `ManuscriptContentPort.getContent()`.
  Verificar o tipo de retorno atual antes de implementar a contagem.

#### Instrucao para implementador

Executar as fases em ordem. Fase 1 (migration) deve preceder Fase 2+ (código que usa os novos campos).
Na Fase 3, verificar TODOS os callers de `store()` via grep antes de alterar a assinatura.
Na Fase 2, verificar TODOS os callers de `EpubBuilder.build()` via grep antes de alterar o retorno.
Não adicionar `totalPaginas` — foi decidido omitir permanentemente (ADR-004).
Não adicionar os 3 campos a `PublicacaoHistoryItemDto` — apenas `PublicacaoStatusDto` (ADR-004 §D-S).

---

### Prioridade 14 -- Reconciliar DRIFT das 8 issues (PUB-002, PUB-003, PUB-005, PUB-007, PUB-013, PUB-016, PUB-018, PUB-021)
Status: pendente
Issues cobertas: PUB-002, PUB-003, PUB-005, PUB-007, PUB-013, PUB-016, PUB-018, PUB-021

#### Objetivo

14 itens classificados como DRIFT: o artefato existe no repo mas o checker buscou por um path/nome
que diverge do path/nome real. A correção é executar `validator-score.py mark` com os itens corretos
em cada issue. Nenhum arquivo novo a criar; nenhum código a alterar.

#### Problemas identificados

| Issue | Item PARTIAL/MISSING | Path esperado pela spec | Path real no repo | Ação |
|---|---|---|---|---|
| PUB-002 | publication-status.vo.ts | `domain/pub/publication-status.vo.ts` | `domain/pub/publicacao-status.enum.ts` | mark item done |
| PUB-002 | pub.enums.ts | `domain/pub/pub.enums.ts` | enums individuais (3 arquivos enum) | mark item done |
| PUB-002 | pub.domain.spec.ts | `domain/pub.domain.spec.ts` | `domain/pub/publicacao.entity.spec.ts` | mark item done |
| PUB-003 | modules/pub/ports/publicacao-repository.port.ts | `modules/pub/ports/publicacao-repository.port.ts` | existe (e também em `domain/pub/ports/`) | mark item done |
| PUB-003 | composition-read.port.ts | `modules/pub/ports/composition-read.port.ts` | split: composition-metadata.port.ts + composition-layout.port.ts | mark item done |
| PUB-003 | project-status.port.ts | `modules/pub/ports/project-status.port.ts` | `modules/pub/ports/advance-projeto-status.port.ts` | mark item done |
| PUB-005 | publication-query.spec.ts | `use-cases/publication-query.spec.ts` | 7 arquivos spec individuais em `use-cases/` | mark item done |
| PUB-007 | database.module.ts "stub" | marcado como stub | funcional: `@Global() @Module` com PrismaService | mark item done |
| PUB-013 | pub-scope.decorator.ts | `decorators/pub-scope.decorator.ts` | `decorators/require-scope.decorator.ts` | mark item done |
| PUB-016 | contracts/api-contract.md §4.6 | path relativo curto | `docs/architecture/backend/services/pub-service/contracts/api-contract.md` (§4.6 existe na linha 249) | mark item done |
| PUB-018 | pub-health.module.ts "stub" | marcado como stub | `infrastructure/pub/health/pub-health.module.ts` funcional | mark item done |
| PUB-018 | app.health.controller.ts | `infrastructure/health/app.health.controller.ts` | `infrastructure/health/health.controller.ts` | mark item done |
| PUB-021 | adr/ADR-004-epub-summary-kpi-field-sources.md | `adr/ADR-004-...` relativo | `docs/architecture/backend/services/pub-service/adr/ADR-004-epub-summary-kpi-field-sources.md` | mark item done |
| PUB-021 | EpubBuilder popula 3 campos | "desmarcado" | EpubBuilder retorna `{epubBytes, totalCapitulos, totalImagens}`; BuildJob persiste `tamanhoBytes + totalCapitulos + totalImagens` (confirmado em P13) | mark item done |

#### Correcoes mandatorias

Para cada issue: executar `python scripts/validator-score.py mark --issue <ISSUE> --layer be --item "<texto-do-item>" --done`.
Ao final de cada issue: executar `python scripts/validator-score.py score --issue <ISSUE> --layer be --write-back` para gravar o score atualizado.

#### Alvos de alteracao

- `docs/architecture/backend/issues/PUB-002.state.json` (3 itens PARTIAL → done)
- `docs/architecture/backend/issues/PUB-003.state.json` (3 itens PARTIAL → done)
- `docs/architecture/backend/issues/PUB-005.state.json` (1 item PARTIAL → done)
- `docs/architecture/backend/issues/PUB-007.state.json` (1 item PARTIAL → done)
- `docs/architecture/backend/issues/PUB-013.state.json` (1 item PARTIAL → done)
- `docs/architecture/backend/issues/PUB-016.state.json` (1 item MISSING → done)
- `docs/architecture/backend/issues/PUB-018.state.json` (2 itens PARTIAL → done)
- `docs/architecture/backend/issues/PUB-021.state.json` (2 itens MISSING → done)

#### Contrato operacional

Deve existir:
- `python scripts/validator-score.py score --issue PUB-002 --layer be` retorna `done: 10` (todos)
- `python scripts/validator-score.py score --issue PUB-003 --layer be` retorna `done: 12`
- `python scripts/validator-score.py score --issue PUB-005 --layer be` retorna `done: 8`
- `python scripts/validator-score.py score --issue PUB-007 --layer be` retorna `done: 9` (o item do spec permanece MISSING — tratado em P15)
- `python scripts/validator-score.py score --issue PUB-013 --layer be` retorna `done: 8` (o item do guard spec permanece MISSING — tratado em P15)
- `python scripts/validator-score.py score --issue PUB-016 --layer be` retorna `done: 10`
- `python scripts/validator-score.py score --issue PUB-018 --layer be` retorna `done: 8`
- `python scripts/validator-score.py score --issue PUB-021 --layer be` retorna `done: 7`

Nao deve existir:
- Nenhuma edição de código-fonte em P14 — apenas state.json
- Novos arquivos criados — zero

Verificacao objetiva:
- `python scripts/validator-score.py score --issue PUB-021 --layer be` → done: 7/7
- Total de itens done no módulo: 163 + 14 = 177/187

Condicao de bloqueio: nenhuma (P14 é independente)

#### Sequencia de execucao

- Fase 1: Reconciliar PUB-021 (prioridade máxima — é o trigger do planner)
- Fase 2: Reconciliar PUB-016, PUB-018 (1-2 itens cada; triviais)
- Fase 3: Reconciliar PUB-002, PUB-003, PUB-005 (3, 3, 1 itens)
- Fase 4: Reconciliar PUB-007, PUB-013 (1 item DRIFT cada; demais itens permanecem para P15)
- Fase 5: Executar `--write-back` em todas as 8 issues e verificar totais

#### Politica de testes

Nenhum teste a executar em P14 — apenas state.json alterados. O `pnpm lint` e `arch-conformance` não
são afetados por mudanças em state.json.

#### Multi-empresa

Não se aplica — P14 não toca código de negócio.

#### Migracoes Prisma Migrate necessarias

Não.

#### Criterios de aceite

- `python scripts/validator-score.py score --issue PUB-021 --layer be` → `done: 7, missing: 0`
- Todos os 8 issues têm `missing: 0` exceto PUB-007 (`missing: 2` → resolvido em P15) e PUB-013 (`missing: 1` → resolvido em P15)
- Checklist global: 177/187 done (163 + 14 reconciliados)

#### Riscos

Baixo. O único risco é marcar um item done que de fato não está — o validator na próxima rodada
detectaria e reverteria o score. Mitigação: verificar o path real de cada artefato antes de marcar.

#### Instrucao para implementador

Não alterar nenhum arquivo `.ts`. Usar exclusivamente `validator-score.py mark --done` e
`validator-score.py score --write-back`. Começar pela Fase 1 (PUB-021) e terminar com o
write-back de cada issue ao final de cada fase.

---

### Prioridade 15 -- Criar 4 specs ausentes (PUB-007, PUB-013, PUB-014, PUB-015)
Status: pendente
Issues cobertas: PUB-007, PUB-013, PUB-014, PUB-015

#### Objetivo

4 arquivos de spec declarados nas issues não existem no repo. Os gates comportamentais
"pnpm test X exits 0" permanecem MISSING enquanto os specs não existirem. P15 cria os 4 specs.

#### Problemas identificados

1. `src/infrastructure/persistence/prisma.service.spec.ts` — `PrismaService` existe mas não tem spec dedicada. O comportamento é testado indiretamente nos repositórios.
2. `src/infrastructure/auth/jwt-auth.guard.spec.ts` — `jwt-auth.guard.ts` existe mas não tem spec. A guarda é testada via integração no controller, não unitariamente.
3. `src/modules/pub/publication-history.service.spec.ts` — se existe `PublicationHistoryService`, precisa de spec própria; o comportamento é testado via `get-publication-history.use-case.spec.ts`.
4. `src/modules/pub/publication-erasure.service.spec.ts` — não existe nenhum spec para o serviço de erasure.

#### Correcoes mandatorias

- Criar `prisma.service.spec.ts`: testar `onModuleInit()` (chama `$connect()`), `enableShutdownHooks()` (chama `$on('beforeExit', ...)`), e que `$connect()` é chamado exatamente uma vez.
- Criar `jwt-auth.guard.spec.ts`: testar que `canActivate()` retorna `true` para JWT válido, lança `UnauthorizedException` para JWT inválido, e que rotas com `@Public()` passam sem token.
- Criar `publication-history.service.spec.ts` (ou `get-publication-history.use-case.spec.ts` se o serviço é o use-case): verificar se `PublicationHistoryService` ou equivalente existe; se o comportamento já está coberto em `get-publication-history.use-case.spec.ts`, criar um spec mínimo que importe e instancie o serviço.
- Criar `publication-erasure.service.spec.ts`: testar `erasePublications(projetoId)` deleta todas as publicações do projeto e seus arquivos no storage.

#### Alvos de alteracao (arquivos a criar)

- `backend/services/pub-service/src/infrastructure/persistence/prisma.service.spec.ts` (novo)
- `backend/services/pub-service/src/infrastructure/auth/jwt-auth.guard.spec.ts` (novo)
- `backend/services/pub-service/src/modules/pub/publication-history.service.spec.ts` (novo, ou confirmar que use-case spec cobre)
- `backend/services/pub-service/src/modules/pub/publication-erasure.service.spec.ts` (novo)

#### Contrato operacional

Deve existir:
- `backend/services/pub-service/src/infrastructure/persistence/prisma.service.spec.ts`
- `backend/services/pub-service/src/infrastructure/auth/jwt-auth.guard.spec.ts`
- `backend/services/pub-service/src/modules/pub/publication-history.service.spec.ts`
- `backend/services/pub-service/src/modules/pub/publication-erasure.service.spec.ts`
- `pnpm test` no pub-service exits 0 com todos os specs acima passando

Nao deve existir:
- Import de `@prisma/client` em arquivos de `domain/` (RULE-01 não afetado por specs em outros layers)
- Mocks de comportamentos não implementados (specs só testam o que o código faz)

Verificacao objetiva:
- `find src -name "prisma.service.spec.ts"` retorna 1 resultado
- `find src -name "jwt-auth.guard.spec.ts"` retorna 1 resultado
- `find src -name "publication-history.service.spec.ts"` retorna 1 resultado
- `find src -name "publication-erasure.service.spec.ts"` retorna 1 resultado
- `pnpm test --testPathPattern="prisma.service|jwt-auth.guard|publication-history.service|publication-erasure.service"` exits 0

Condicao de bloqueio: P14 deve estar DONE (score reconciliado reduz ruído)

#### Sequencia de execucao

- Fase 1: Criar `prisma.service.spec.ts` — spec simples com mock de `$connect` e `$on`
- Fase 2: Criar `jwt-auth.guard.spec.ts` — mock de `JwtService.verify()`; testar 3 casos (válido/inválido/public)
- Fase 3: Verificar se `PublicationHistoryService` existe como classe separada; criar spec adequada
- Fase 4: Criar `publication-erasure.service.spec.ts` — mock de `PublicacaoRepositoryPort` e `FileStoragePort`
- Fase 5: Executar `pnpm test` e `pnpm lint` no pub-service; corrigir erros antes de marcar done

#### Politica de testes

Unit tests obrigatórios para todos os 4 specs. Sem integration tests (sem DB real necessário em P15).

#### Multi-empresa

`PrismaService` usa `EmpresaContext` (AsyncLocalStorage) para definir `search_path`. O spec de
`prisma.service.spec.ts` deve mockar `EmpresaContextHolder` se `onModuleInit` o invoca.
Demais specs não tocam multi-empresa.

#### Migracoes Prisma Migrate necessarias

Não.

#### Criterios de aceite

- 4 arquivos de spec criados nos paths declarados
- `pnpm test` no pub-service exits 0 (todos os 161+ testes existentes + novos)
- `pnpm lint` exits 0
- `python scripts/validator-score.py score --issue PUB-007 --layer be` → `done: 10/10` (após mark dos itens de spec)
- `python scripts/validator-score.py score --issue PUB-013 --layer be` → `done: 9/9`
- `python scripts/validator-score.py score --issue PUB-014 --layer be` → `done: 9/9`
- `python scripts/validator-score.py score --issue PUB-015 --layer be` → `done: 8/8`

#### Riscos

- `PublicationHistoryService`: verificar via grep se a classe existe ou se é apenas o use-case; o spec deve apontar para o artefato certo.
- `JwtAuthGuard` usa `PassportAuthGuard` como base — mock de `ExecutionContext` pode ser verboso; seguir padrão de `empresa-context.middleware.spec.ts` do próprio serviço.

#### Instrucao para implementador

Antes de criar cada spec, executar `grep -rn "class Publication.*Service\|class PrismaService\|class JwtAuthGuard" src/` para confirmar nomes exatos de classe. Não criar mocks de comportamentos ausentes. Após criar, executar `pnpm test --testPathPattern=<spec>` para verificar passe individual antes de avançar para o próximo.

---

### Prioridade 16 -- Domain events PUB-004 (publication-succeeded.event.ts + publication-failed.event.ts)
Status: pendente
Issues cobertas: PUB-004

#### Objetivo

PUB-004 tem 3 itens MISSING: 2 arquivos de domain event ausentes e 1 gate comportamental (dispatch
após persistência). A implementação atual de `PublicationBuildJob` usa callbacks diretos em vez de
domain events. P16 cria os 2 value-object classes de domain event e atualiza o BuildJob para
instanciá-los e despachá-los via `EventEmitter2` (já disponível no ecossistema NestJS) após o
`update()` de persistência.

#### Problemas identificados

1. `src/domain/pub/events/publication-succeeded.event.ts` — diretório `events/` não existe em `domain/pub/`; evento não criado.
2. `src/domain/pub/events/publication-failed.event.ts` — idem.
3. Dispatch após persistência — gate comportamental: `PublicationBuildJob` deve disparar o evento depois do `update()` final, não antes.

#### Correcoes mandatorias

- Criar diretório `src/domain/pub/events/`
- Criar `publication-succeeded.event.ts`: classe `PublicationSucceededEvent` com campos `publicacaoId: string`, `projetoId: string`, `empresaId: string`, `tamanhoBytes: number`, `totalCapitulos: number`, `totalImagens: number`.
- Criar `publication-failed.event.ts`: classe `PublicationFailedEvent` com campos `publicacaoId: string`, `projetoId: string`, `empresaId: string`, `reason: string`.
- Adicionar `EventEmitter2` ao `PubModule` (ou `PubInfraBindingsModule`): `imports: [EventEmitterModule.forRoot()]` — verificar se já existe no app.module.
- Atualizar `PublicationBuildJob`: injetar `EventEmitter2`; após o bloco de persistência de desfecho `publicado` ou `com_erros`, emitir o evento correspondente: `this.eventEmitter.emit('publication.succeeded', new PublicationSucceededEvent(...))` ou `publication.failed`.

#### Alvos de alteracao (caminhos completos)

- `backend/services/pub-service/src/domain/pub/events/publication-succeeded.event.ts` (novo)
- `backend/services/pub-service/src/domain/pub/events/publication-failed.event.ts` (novo)
- `backend/services/pub-service/src/modules/pub/use-cases/publication-build.job.ts` (adicionar EventEmitter2 + emit após persistência)
- `backend/services/pub-service/src/modules/pub/use-cases/publication-build.job.spec.ts` (assertar que event.emit é chamado após update)
- `backend/services/pub-service/src/modules/pub/pub.module.ts` (ou infra bindings module — adicionar EventEmitterModule se ausente)

#### Contrato operacional

Deve existir:
- `src/domain/pub/events/publication-succeeded.event.ts` com classe `PublicationSucceededEvent`
- `src/domain/pub/events/publication-failed.event.ts` com classe `PublicationFailedEvent`
- `PublicationBuildJob` chama `eventEmitter.emit(...)` após o `update()` de desfecho (nunca antes)
- `publication-build.job.spec.ts` asserta `eventEmitterMock.emit` chamado 1 vez com os dados corretos

Nao deve existir:
- Import de `@nestjs/*` ou `@prisma/client` nas classes de evento em `domain/pub/events/` (RULE-01, RULE-02)
- Evento emitido ANTES da persistência
- `EventEmitter2` injetado diretamente em classes de `domain/` (apenas em `modules/` e `infrastructure/`)

Verificacao objetiva:
- `grep -rn "EventEmitter2\|eventEmitter" src/modules/pub/use-cases/publication-build.job.ts` retorna hits
- `find src/domain/pub/events -name "*.ts"` retorna 2 arquivos
- `grep "import.*@nestjs\|import.*@prisma" src/domain/pub/events/publication-succeeded.event.ts` retorna 0 linhas (RULE-01/02)
- `pnpm test` exits 0
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0 (5/5)

Condicao de bloqueio: P15 deve estar DONE (para não misturar gates de pnpm test)

#### Sequencia de execucao

- Fase 1 — domain/events: criar `publication-succeeded.event.ts` e `publication-failed.event.ts` como plain TypeScript classes (zero decorators NestJS, zero Prisma imports)
- Fase 2 — module wiring: verificar se `EventEmitterModule` já está registrado no app; se não, adicionar `EventEmitterModule.forRoot()` em `pub.module.ts` ou `PubInfraBindingsModule`
- Fase 3 — BuildJob update: injetar `EventEmitter2` no construtor de `PublicationBuildJob`; após `this.publicacaoRepository.update(...)` no bloco de desfecho `publicado`, emitir `publication.succeeded`; no bloco de desfecho `com_erros`, emitir `publication.failed`
- Fase 4 — spec update: no `publication-build.job.spec.ts`, adicionar mock de `EventEmitter2` e assertar que `emit` é chamado após `update()` no cenário happy-path e no cenário de falha
- Fase 5 — gate: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `arch-conformance.py` — todos devem passar

#### Politica de testes

Unit test obrigatório: `publication-build.job.spec.ts` (atualizar, não criar). Integration test não necessário.

#### Multi-empresa

`PublicationSucceededEvent` e `PublicationFailedEvent` devem incluir `empresaId` como campo para
que handlers downstream possam propagar o contexto. O BuildJob já tem acesso ao `empresaId` via
`runAs` — passar no construtor do evento.

#### Migracoes Prisma Migrate necessarias

Não.

#### Criterios de aceite

- `find src/domain/pub/events -name "*.ts"` → 2 arquivos
- `grep "import.*@nestjs\|import.*@prisma" src/domain/pub/events/*.ts` → 0 linhas
- `pnpm test` exits 0 (todos os specs incluindo os 4 de P15)
- `pnpm lint` exits 0
- `python scripts/arch-conformance.py check --layer be --target backend/services/pub-service` exits 0 (5/5)
- `python scripts/validator-score.py score --issue PUB-004 --layer be` → `done: 12/12`

#### Riscos

- `EventEmitterModule.forRoot()` pode conflitar com módulo já registrado como Global; verificar via grep antes de adicionar.
- Testes de `PublicationBuildJob` podem ser sensíveis à ordem de chamadas (verify order): usar `jest.fn()` simples + `toHaveBeenCalledWith`.

#### Instrucao para implementador

Criar os event files primeiro (Fase 1) para garantir RULE-01/02 antes de tocar o BuildJob.
Em Fase 3, procurar o exato bloco de persistência do desfecho via `grep -n "publicado\|com_erros\|update(" src/modules/pub/use-cases/publication-build.job.ts`.
O emit deve ser a ÚLTIMA instrução antes do bloco de cleanup/finally do job — nunca antes do `update()` de persistência.

---

## 3. Dependências externas

| Dependência | Direção | Quem fornece | Quando necessário | Status |
|---|---|---|---|---|
| `ManuscriptContentPort` (IMP) | PUB importa | imp-service HTTP | P6 (INT-PUB-001) | DONE — `ImpManuscriptContentAdapter` |
| `CompositionMetadataPort` (COMP) | PUB importa | comp-service HTTP | P10 (INT-PUB-002) | pendente — stub em PUB-012 |
| `CompositionLayoutPort` (COMP) | PUB importa | comp-service HTTP | P10 (INT-PUB-002) | pendente — stub em PUB-012 |
| `AdvanceProjetoStatusPort` (PROJ) | PUB chama | proj-service HTTP | P6 (INT-PUB-003) | DONE — `ProjProjectStatusAdapter` |
| `PublicationHistoryPort` | PROJ importa de PUB | PubModule export | P6 (INT-PUB-004) | DONE |
| `PublicationErasurePort` | PROJ importa de PUB | PubModule export | P6 (INT-PUB-005) | DONE |
| epubcheck JAR + JRE | PUB infra | ops/local | P4 (PUB-010) | `EPUBCHECK_JAR_PATH` |
| FileStorage (disco) | PUB infra | local disk | P4 (PUB-011) | `PUB_STORAGE_ROOT` |
| comp-service URL | PUB infra | env var | P10 (INT-PUB-002) | `COMP_SERVICE_URL` (default `http://localhost:3003`) |

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
