# Plano -- PUB (pub-service, Publicação)

## Status das prioridades

- P1 -- DONE
- P2 -- DONE
- P3 -- DONE
- P4 -- DONE
- P5 -- DONE
- P6 -- PARTIAL (PUB-014 DONE, PUB-015 DONE, PUB-016 DONE; INT-PUB-001/002/003 BLOCKED [requer IMP/COMP/PROJ])
- P7 -- DONE (PUB-017: Correlation interceptor + structured logging. PUB-018: Health endpoint com epubcheck liveness check. 2026-08-26 17:59)
- P8 -- DONE (PUB-019: BDD step definitions manuais + execução dos 3 feature files; 22/22 scenarios PASS @ 2026-08-26 19:08)
- P9 -- pendente (PUB-020: Runbook de reconciliação de build órfão)

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
Status: PARTIAL (PUB-014 DONE, PUB-015 DONE; INT-PUB-001/002/003 BLOCKED por dependência externa; PUB-016 BLOCKED por ratificação FE)

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
Status: pendente

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
