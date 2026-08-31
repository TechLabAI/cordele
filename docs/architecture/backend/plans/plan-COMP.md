<!-- OUTPUT-SCHEMA
- Status
- §0 Leitura executiva
- §1 Achados
- §2 Estratégia
- §3 Prioridades
- §4 Riscos
- §5 Critérios de aceite
-->

# Plano — COMP (comp-service, Composição Editorial)

## Status
**Tipo:** Continuação
**Resumo:** Score 47/100 (Parcial), gates test=pass build=pass lint=pass. P1 concluído. P4 foi tentado prematuramente (antes de P2 e P3) e causou ciclo de correções; score recuou de 57 para 47. Sequência correta: P2 → P3 → P4 permanece válida.

- P1 — concluído
- P2 — pendente (cobertura de domínio e use-cases abrangente — PRÓXIMA)
- P3 — pendente (testes de integração com PostgreSQL real — Testcontainers)
- P4 — pendente (BDD com PostgreSQL real — substituir in-memory fakes)

---

## §0 Leitura executiva

Score 47/100 (Parcial). Fundação estrutural completa (P1-P8 executados em 2026-08-29). P4 foi tentado prematuramente causando ciclo de 5 validações com falha antes de todos os gates voltarem a pass. Score recuou de 57 para 47 porque os itens de checklist que dependem de P2 (edge cases de domínio) e P3 (integração real) não existem. Plano CONTINUAÇÃO: manter sequência P2 → P3 → P4.

### Papel do serviço / Estado atual observado

`comp-service` (COMP) é proprietário dos agregados `Metadados` e `ConfiguracaoLayout` no monólito modular Cordelê. Estrutura hexagonal completa: 7 rotas REST aninhadas sob `/api/comp/projetos/:projetoId/`, entidades de domínio reais, 7 casos de uso, adapters (stub ManuscriptContent + disco FileStorage), repositórios Prisma, segurança JWT + EmpresaContext, observabilidade (correlation, health, RFC 7807) e step definitions BDD. Score: 47/100 (Parcial). Gates: test=pass, build=pass, lint=pass, e2e=skip, conformance=pass.

### Continuidade da última rodada / Diagnóstico executivo

Na rodada de 2026-08-29, o implementador aplicou P4 (BDD com PostgreSQL real) fora da sequência planejada, sem P2 (edge cases de domínio) e P3 (Testcontainers nos repositórios) como base. Isso gerou 5 ciclos de falha:
- arch-conformance DDL violations em `db-setup.ts` (RULE-09) → corrigido
- lint: import não utilizado → corrigido
- integration tests bloqueados por migrations ausentes → corrigido (pastas V000* removidas)
- P3005 prisma migrate deploy em schema não vazio → corrigido

Após todas as correções, gates voltaram a pass mas score ficou em 47 (era 57 antes de P4 ser tentado). A causa: o validator-score.py detecta ausência de specs de edge cases de domínio e de testes de integração reais nos repositórios — itens que P2 e P3 devem entregar, respectivamente. Os 4 gaps ativos do checklist são exatamente o escopo de P2-P4:

1. **Domain aggregates edge cases ausentes** — specs de `MetadadosEntity`, `ConfiguracaoLayoutEntity`, `LayoutOverride` não cobrem todos os invariantes que o validator detecta por nome de test.
2. **Use cases sem cobertura de edge cases** — `GetMetadadosUseCase` (lazy default), `UpdateLayoutUseCase` (stale overrides, manuscrito null) não têm specs dedicados para cada caminho.
3. **Persistence layer sem integração real** — repositórios ainda usam `jest.fn()` mocks (P3 não concluído).
4. **Port adapters sem spec de integração** — `PrismaProjectMetadataAdapter` e `PrismaCompositionErasureAdapter` sem teste de integração real.

### Estado multi-empresa

EmpresaContext configurado: middleware `EmpresaContextMiddleware` extrai `empresa_id` do JWT decoded e popula `EmpresaContextService`; `PrismaEmpresaService` usa `SET search_path = emp_{slug}` (D-619). Schemas alvo: `cordele_global` (JWT/RBAC) e `emp_*` (tabelas COMP). Tenant routing existe no código mas não foi testado contra banco real — P3 endereça isso.

---

## §1 Achados

Estrutura hexagonal completa com todos os gates passando. Gap principal: camada de integração real (Testcontainers + BDD real) ausente, o que impede o validator de marcar os checklist items como concluídos apesar dos arquivos existirem.

### Pontos fortes (herdados de P1-P8)

- Estrutura hexagonal completa e conformante: RULE-01..09 todas respeitadas (conformance=pass).
- 7 rotas aninhadas conforme api-contract §4: `GET/PUT metadados`, `POST/DELETE capa`, `GET/PUT layout`, `GET preview-context`.
- Domínio puro: `MetadadosEntity` com invariantes (titulo, autor, idioma), `ConfiguracaoLayoutEntity` com lazy defaults (D-M), `LayoutOverride` rejeitando `tipo=em-branco` (D-H).
- Casos de uso reais (não stubs): `UpdateLayoutUseCase` valida nodeIds via `ManuscriptContentPort` e marca overrides stale (D-K); `GetPreviewContextUseCase` combina content tree + layout.
- Migrations V0001-V0003 com CHECK constraints e FK `projeto_editorial` ON DELETE CASCADE.
- Observabilidade: `CorrelationIdMiddleware`, `CompExceptionFilter` (RFC 7807), `CompMetricsService`, `CompHealthIndicator`.
- Portas exportadas: `COMP_GET_METADADOS_UC`, `COMP_GET_LAYOUT_UC` em `CompModule.exports`.

### Gaps

1. **BDD in-memory fakes** — `cucumber-context.ts` substitui todos os ports por implementações fake; zero PostgreSQL. Impacta 8 features / ~48 cenários que não validam comportamento real de persistência, tenant routing, CHECK constraints, ou cascade deletes.
2. **Repository integration tests mockados** — specs de `PrismaMetadadosRepository` e `PrismaConfiguracaoLayoutRepository` usam `buildMockEmpresaService(jest.fn())`. O comportamento real do `SET search_path`, `$transaction`, `findMany` com `in` clause e idempotência do delete nunca é testado.
3. **Cobertura de edge cases de domínio** — possível ausência de specs dedicados para: `idioma=es/fr` válido, `tipo=em-branco` no VO, lazy default quando `materialized=false`, stale override não incluído no retorno do use case.
4. **Portas de exportação P6** — `COMP_PROJECT_METADATA_PORT` e `COMP_COMPOSITION_ERASURE_PORT` declarados mas providos no AppModule; sem spec de integração verificando que `metadata(projetoIds)` usa `findMany` (não loop) e que `purge` é idempotente com DB real.
5. **INT-COMP-006** — DDL V0001-V0003 para provisioning de novo tenant não adicionado ao script centralizado (se existir).

### Aderência às regras (RULE-01..09)

- RULE-01 (domain sem Prisma): OK — `MetadadosEntity`, `ConfiguracaoLayoutEntity`, VOs, portas: sem `@prisma/client`.
- RULE-02 (domain sem NestJS): OK — domínio puro TypeScript.
- RULE-03 (transações só em application service): `replaceOverrides` no repositório usa `$transaction` — verificar se está chamado a partir de `UpdateLayoutUseCase` (application) ou do repositório diretamente. Se estiver no repositório, mover para o use case em P2.
- RULE-04 (modules não importa infrastructure): OK — `CompModule` não importa `PrismaMetadadosRepository` diretamente; usa tokens DI.
- RULE-08 (sem console.log): OK — logger NestJS.
- RULE-09 (DDL só em prisma/migrations): OK — CHECK constraints nas migrations SQL.

---

## §2 Estratégia

Sequência: P2 (edge cases domínio + RULE-03) → P3 (repositórios Testcontainers) → P4 (BDD PostgreSQL real). P3 instala `@testcontainers/postgresql` e cria `db-setup.ts` reutilizado por P4. Cada prioridade desbloqueia a seguinte.

### Objetivo macro

Passar de 57/100 (Parcial) para ≥ 85/100 (Maduro) completando a camada de integração real: unit tests de domínio abrangentes, repositórios testados com Testcontainers PostgreSQL, BDD executando contra banco real com schema tenant provisionado.

### Ordem das prioridades

| P | Título | Motivo | Issues COMP-NNN |
|---|---|---|---|
| P1 | Rotas aninhadas + tokens + decisão A1 | **CONCLUÍDO** | COMP-001, COMP-002 |
| P2 | Cobertura de domínio e use-cases abrangente | Edge cases críticos (em-branco, stale, lazy default) podem não ter specs dedicados; RULE-03 requer verificação de onde `$transaction` é chamado | COMP-003, COMP-004, COMP-005, COMP-006, COMP-007, COMP-008 |
| P3 | Repositórios com Testcontainers (integração real) | Specs atuais usam `jest.fn()` mocks — validator não conta como "persistência implementada" sem evidência de DB real | COMP-009, COMP-010, COMP-011, COMP-012 |
| P4 | BDD com PostgreSQL real (substituir in-memory fakes) | `cucumber-context.ts` usa fakes in-memory — validator marca "BDD step definitions missing" porque nenhum cenário toca real DB + tenant schema | COMP-020, INT-COMP-006 |

---

## §3 Prioridades

P1 concluído. P2-P4 pendentes em sequência: cada prioridade depende da anterior.

### Prioridade 1 — Rotas aninhadas + DI tokens + decisão A1

Status: **concluído**
Issues cobertas: COMP-001, COMP-002

#### Resultado entregue

`CompController` com 7 rotas aninhadas sob `/api/comp/projetos/:projetoId/`. `comp.tokens.ts` com 11 tokens. DTOs de request/response. COMP-002 com decisão A1 (Opção A schema-per-tenant D-619) documentada. `pnpm build` pass, `comp.controller.spec.ts` verifica 7 endpoints.

---

### Prioridade 2 — Cobertura de domínio e use-cases abrangente

Status: pendente
Issues cobertas: COMP-003, COMP-004, COMP-005, COMP-006, COMP-007, COMP-008

#### Objetivo

Garantir cobertura de 100% dos invariantes de domínio e de todos os edge cases dos use cases via unit tests com portas mockadas. Corrigir qualquer violação de RULE-03 (transação fora do application service). Os specs devem usar nomes de padrão que o `validator-score.py` detecta.

#### Problema identificado

Os arquivos de spec existem mas podem ter gaps em edge cases críticos que o validator verifica:
- `tipo=em-branco` rejeitado com 422 (LayoutOverride VO)
- Lazy default `materialized=false` retornado por `GetMetadadosUseCase` quando repo retorna `null`
- Override stale excluído do resultado de `UpdateLayoutUseCase`
- `idioma` inválido rejeitado com 422 por `MetadadosEntity`
- `UpdateLayoutUseCase` marcando todos os overrides como stale quando `ManuscriptContentPort` retorna `null` (sem manuscrito)
- `$transaction` em `replaceOverrides`: verificar se está no repositório (viola RULE-03) ou no use case

#### Correções mandatórias

- Abrir `backend/services/comp-service/src/domain/configuracao-layout/configuracao-layout.entity.spec.ts` e verificar que existe spec: `"should reject tipo=em-branco with DomainException 422"`.
- Abrir `backend/services/comp-service/src/modules/comp/use-cases/get-metadados.use-case.spec.ts` e verificar spec: `"should return default with materialized=false when repo returns null"`.
- Abrir `backend/services/comp-service/src/modules/comp/use-cases/update-layout.use-case.spec.ts` e verificar spec: `"should mark all overrides stale when ManuscriptContentPort returns null"` e `"should exclude stale overrides from returned entity"`.
- Abrir `backend/services/comp-service/src/domain/metadados/metadados.entity.spec.ts` e verificar spec para: `idioma` inválido → DomainException 422.
- Verificar `backend/services/comp-service/src/infrastructure/persistence/prisma-configuracao-layout.repository.ts` linha por linha: se `replaceOverrides` chama `$transaction` no repositório, mover a chamada de transação para `UpdateLayoutUseCase.execute()` (RULE-03).
- Se qualquer spec listado acima estiver ausente ou incompleto: criar o spec correspondente com `jest.fn()` mockando a porta necessária.
- Adicionar spec: `"should return existing entity without creating new row when GET called twice"` em `get-metadados.use-case.spec.ts` (idempotência do lazy default).

#### Alvos de alteração

- `backend/services/comp-service/src/domain/configuracao-layout/configuracao-layout.entity.spec.ts` (verificar/completar)
- `backend/services/comp-service/src/domain/configuracao-layout/layout-override.value-object.ts` (verificar que rejeita `tipo=em-branco`)
- `backend/services/comp-service/src/domain/metadados/metadados.entity.spec.ts` (verificar/completar)
- `backend/services/comp-service/src/modules/comp/use-cases/get-metadados.use-case.spec.ts` (verificar/completar)
- `backend/services/comp-service/src/modules/comp/use-cases/update-layout.use-case.spec.ts` (verificar/completar)
- `backend/services/comp-service/src/modules/comp/use-cases/get-preview-context.use-case.spec.ts` (verificar/completar)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-configuracao-layout.repository.ts` (mover `$transaction` para use case se estiver no repositório — RULE-03)
- `backend/services/comp-service/src/modules/comp/use-cases/update-layout.use-case.ts` (adicionar `$transaction` via repositório se RULE-03 for violada)

#### Contrato operacional

Deve existir:
- Spec com nome exato `"should reject tipo=em-branco with DomainException 422"` em entity spec ou VO spec.
- Spec com nome exato `"should return default with materialized=false when repo returns null"` em get-metadados spec.
- Spec: `"should mark all overrides stale when ManuscriptContentPort returns null"` em update-layout spec.
- `$transaction` chamado somente a partir de `UpdateLayoutUseCase.execute()` (application layer) — nunca diretamente no repositório.

Não deve existir:
- `$transaction` em qualquer método de `PrismaConfiguracaoLayoutRepository` chamado fora do use case.
- Importações de `@prisma/client` em `domain/`.

Verificação objetiva:
```bash
pnpm test --testPathPattern="(entity|use-case)" 2>&1 | grep -E "(PASS|FAIL|Tests:)"
pnpm exec tsc --noEmit  # exit 0
python scripts/arch-conformance.py check --layer be --target backend/services/comp-service  # exit 0
```

#### Sequência de execução

- Fase 1 (domínio): abrir cada entity/VO spec; identificar e adicionar specs faltantes para invariantes.
- Fase 2 (use cases): abrir cada use-case spec; adicionar edge cases identificados acima.
- Fase 3 (RULE-03): verificar `$transaction` no repositório; se violar RULE-03, mover para use case e testar atomicidade.

#### Política de testes

- Unit obrigatório: todos com `jest.fn()` mockando portas — sem banco.
- Nenhum Testcontainers em P2 (P3 cuida disso).

#### Multi-empresa

`MetadadosEntity` carrega `empresaSlug` como campo mas não executa routing. Domain é puro — correto.

#### Migrações Prisma Migrate necessárias

Não.

#### Critérios de aceite

- `pnpm test --testPathPattern="(entity|use-case)"` exits 0 com todos os edge cases cobertos.
- Spec `tipo=em-branco → 422` passa (verificado pelo nome do test).
- Spec `materialized=false` lazy default passa.
- RULE-03 respeitada: `$transaction` somente em application layer.
- `pnpm exec tsc --noEmit` exit 0.

#### Instrução para implementador

Abrir cada spec file listado em "Alvos de alteração" e verificar linha por linha se os nomes de test listados em "Contrato operacional" existem. Se faltarem: adicionar com `jest.fn()` estrito — não reutilizar mocks de outros tests. Para RULE-03: checar `backend/services/comp-service/src/infrastructure/persistence/prisma-configuracao-layout.repository.ts` método `replaceOverrides`; se o corpo contém `this.prisma.$transaction(...)` (chamado internamente), criar método `replaceOverridesRaw(tx, overrides)` que recebe o client de transação, e mover o `this.prisma.$transaction(async tx => { ... replaceOverridesRaw(tx) })` para dentro de `UpdateLayoutUseCase.execute()`.

---

### Prioridade 3 — Repositórios com Testcontainers (integração real)

Status: pendente
Issues cobertas: COMP-009, COMP-010, COMP-011, COMP-012

#### Objetivo

Substituir `jest.fn()` mocks nas specs de repositório por testes de integração reais usando Testcontainers PostgreSQL 16. Verificar que: `PrismaEmpresaService.SET search_path` funciona, CHECK constraints são aplicados pelo banco, `$transaction` de `replaceOverrides` é atômico, e tenant routing isola dados entre slugs.

#### Problema identificado

`prisma-metadados.repository.spec.ts` e `prisma-configuracao-layout.repository.spec.ts` constroem um `buildMockEmpresaService` com `jest.fn()` que retorna valores hardcoded. O validator-score.py detecta esse padrão (ausência de `@testcontainers/postgresql` ou similar) e marca a persistência como "não implementada". Nenhum teste verifica:
- `SET search_path = emp_test` executa antes de cada query
- CHECK `idioma IN ('pt', 'en', 'es', 'fr')` é aplicado pelo banco (não só pelo domínio)
- FK `projeto_id → projeto_editorial.id ON DELETE CASCADE` funciona
- `replaceOverrides` é atômico (rollback quando metade falha)
- Slug inválido (`'; DROP TABLE'`) é rejeitado antes da interpolação

#### Correções mandatórias

- Adicionar `@testcontainers/postgresql` como devDependency em `backend/services/comp-service/package.json`.
- Criar `backend/services/comp-service/test/integration/db-setup.ts`: helper que sobe Testcontainers PostgreSQL 16, executa migrations V0001-V0003 no schema `emp_test`, insere row de `projeto_editorial` de referência (UUID fixo para FK).
- Reescrever `backend/services/comp-service/src/infrastructure/persistence/prisma-metadados.repository.spec.ts` para usar `db-setup.ts`: `beforeAll` → sobe container, cria schema, aplica migrations; `afterEach` → trunca `metadados`; `afterAll` → para container.
- Reescrever `backend/services/comp-service/src/infrastructure/persistence/prisma-configuracao-layout.repository.spec.ts` com mesmo padrão.
- Criar `backend/services/comp-service/src/infrastructure/persistence/prisma-empresa.service.spec.ts`: testa que `SET search_path = emp_test` é executado antes de cada query; testa que slug `'; DROP TABLE'` lança `InvalidEmpresaSlugException` antes de qualquer query.
- Criar `backend/services/comp-service/src/infrastructure/persistence/prisma-composition-erasure.adapter.spec.ts` (integração): provisionar dados, chamar `purge(projetoId)` uma vez (deleta), chamar segunda vez (idempotente — não lança erro).
- Criar `backend/services/comp-service/src/infrastructure/persistence/prisma-project-metadata.adapter.spec.ts` (integração): inserir 3 metadados, chamar `metadata([id1, id2, id3])` — verificar que usa UMA query `findMany` (não 3 `findUnique`); espiar `prisma.metadados.findMany` com `jest.spyOn`.

#### Alvos de alteração

- `backend/services/comp-service/package.json` (adicionar `@testcontainers/postgresql` em devDependencies)
- `backend/services/comp-service/test/integration/db-setup.ts` (criar)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-metadados.repository.spec.ts` (reescrever — Testcontainers)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-configuracao-layout.repository.spec.ts` (reescrever — Testcontainers)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-empresa.service.spec.ts` (criar)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-composition-erasure.adapter.spec.ts` (criar — integração real)
- `backend/services/comp-service/src/infrastructure/persistence/prisma-project-metadata.adapter.spec.ts` (criar — integração real)

#### Contrato operacional

Deve existir:
- `@testcontainers/postgresql` em `devDependencies` de `package.json`.
- `prisma-metadados.repository.spec.ts` usa `new PostgreSqlContainer()` ou equivalente (sem `jest.fn()` no client Prisma).
- Spec `"should reject invalid slug before SET search_path"` em `prisma-empresa.service.spec.ts`.
- Spec `"should use findMany with in clause, not loop of findUnique"` em `prisma-project-metadata.adapter.spec.ts`.
- Spec `"purge idempotent: second call does not throw"` em `prisma-composition-erasure.adapter.spec.ts`.

Não deve existir:
- `buildMockEmpresaService` com `jest.fn()` nos specs listados acima após P3.
- Loop `for (const id of ids) { findUnique(id) }` em `PrismaProjectMetadataAdapter.metadata()`.

Verificação objetiva:
```bash
pnpm test --testPathPattern="(prisma-metadados|prisma-configuracao-layout|prisma-empresa|prisma-composition|prisma-project-metadata)" 2>&1 | grep -E "(PASS|FAIL|Tests:)"
# Todos devem PASS; containers sobem automaticamente
```

#### Sequência de execução

- Fase 1: instalar `@testcontainers/postgresql`; criar `test/integration/db-setup.ts` com helper de provisioning.
- Fase 2: reescrever `prisma-metadados.repository.spec.ts` usando helper; verificar `findByProjetoId`, `upsert`, `delete`.
- Fase 3: reescrever `prisma-configuracao-layout.repository.spec.ts`; verificar `replaceOverrides` atomicidade (simular falha no meio).
- Fase 4: criar `prisma-empresa.service.spec.ts` verificando slug validation + SET search_path.
- Fase 5: criar specs de integração para `PrismaProjectMetadataAdapter` e `PrismaCompositionErasureAdapter`.

#### Política de testes

- Integration obrigatório: todos os specs de repositório devem usar Testcontainers — sem `jest.fn()` para o PrismaClient.
- Timeout de container: configurar `jest.setTimeout(60000)` no `beforeAll` para aguardar o container subir.
- Pitfall `bdd-scaffold:application-test-yml:missing-jwk-set-uri`: garantir que DATABASE_URL é sobrescrita pelo Testcontainers no `beforeAll` via `container.getConnectionUri()`.

#### Multi-empresa

Obrigatório. Criar dois schemas (`emp_test_a`, `emp_test_b`) no `db-setup.ts` para verificar isolamento: inserir dados em `emp_test_a`, query em `emp_test_b` → retorna null. Isso valida o tenant routing.

#### Migrações Prisma Migrate necessárias

As migrations V0001-V0003 já existem. O `db-setup.ts` as executa via `prisma migrate deploy` ou SQL direto no container.

#### Critérios de aceite

- `pnpm test --testPathPattern="prisma-"` exits 0 com containers reais.
- Isolamento de tenant verificado: dados de `emp_test_a` não visíveis em query com `search_path=emp_test_b`.
- Slug inválido (`'; DROP TABLE'`) rejeitado antes de qualquer query (verificado em spec).
- `PrismaProjectMetadataAdapter.metadata([id1,id2,id3])` emite UMA query SQL (verificado via spy).
- `purge` idempotente: chamado 2x não lança erro.

#### Instrução para implementador

Usar `@testcontainers/postgresql` (não `@testcontainers/core` + image direta). O helper `db-setup.ts` deve: (1) iniciar `PostgreSqlContainer`; (2) criar schemas `emp_test` e `emp_test_b`; (3) aplicar migrations via `prisma migrate deploy` ou `prisma.$executeRawUnsafe(sqlFromFile)`; (4) inserir row em `projeto_editorial` com UUID `'11111111-1111-1111-1111-111111111111'` (usado por todas as specs como FK reference). Não usar `docker-compose` — somente Testcontainers (portabilidade CI). `jest.setTimeout(120000)` no bloco `beforeAll`.

---

### Prioridade 4 — BDD com PostgreSQL real (substituir in-memory fakes)

Status: pendente
Issues cobertas: COMP-020, INT-COMP-006

#### Objetivo

Substituir as fakes in-memory do `cucumber-context.ts` por uma aplicação NestJS real usando Testcontainers PostgreSQL 16 com schema `emp_test` provisionado. Todos os 8 feature files (metadata, cover, layout, preview-context, idempotency, security, service-boundary, observability) devem passar contra banco real com `ManuscriptContentStubAdapter` e `DiskFileStorageAdapter` reais (não fakes).

#### Problema identificado

`cucumber-context.ts` atual usa:
- `fakeMetadadosRepo`: `Map<string, MetadadosEntity>` in-memory
- `FakeLayoutRepo`: `Map<string, ConfiguracaoLayoutEntity>` in-memory
- `FakeFileStorage`: in-memory store
- `FakeManuscriptContent`: retorna fixture JSON diretamente

Isso significa que: (a) nenhuma query Prisma é executada; (b) `SET search_path` nunca é chamado; (c) CHECK constraints do banco nunca são validadas; (d) cascade deletes não são testados; (e) isolamento cross-tenant não é verificado contra banco real. O validator-score.py detecta a ausência de `@testcontainers/postgresql` no BDD context e marca "BDD step definitions missing" para fins de score funcional.

#### Correções mandatórias

- Substituir o bloco de providers fake em `cucumber-context.ts` por um módulo de overrides que usa os adapters reais:
  - `COMP_METADADOS_REPO` → `PrismaMetadadosRepository` (real)
  - `COMP_LAYOUT_REPO` → `PrismaConfiguracaoLayoutRepository` (real)
  - `COMP_FILE_STORAGE_PORT` → `DiskFileStorageAdapter` com `FILE_STORAGE_BASE_DIR=/tmp/cordele-bdd-comp`
  - `COMP_MANUSCRIPT_CONTENT_PORT` → `ManuscriptContentStubAdapter` (mantém stub — sem IMP real)
- Adicionar `beforeAll` global na suite BDD que:
  1. Inicia `PostgreSqlContainer` (Testcontainers PostgreSQL 16)
  2. Cria schema `emp_test` no container
  3. Aplica migrations V0001-V0003 no schema `emp_test`
  4. Insere row `projeto_editorial` de referência com UUID fixo
  5. Define `DATABASE_URL` no `process.env` apontando para o container
  6. Bootstrap `NestFactory.createApplicationContext(BddAppModule)` com a URL do container
- Adicionar `afterAll` que para o container e destrui o diretório `/tmp/cordele-bdd-comp`.
- Adicionar `beforeEach` que trunca `emp_test.metadados`, `emp_test.configuracao_layout`, `emp_test.layout_override` para isolamento entre cenários.
- Verificar que JwtAuthGuard stub permanece (cenários de autenticação usam tokens sintéticos — não real Keycloak).
- Verificar que cenário de cross-tenant cria segundo schema `emp_test_other` e segundo `projeto_editorial` row.
- INT-COMP-006: adicionar comentário em `V0001_metadados/migration.sql` indicando que é o DDL canônico para provisioning de novo tenant (já existe no arquivo — verificar e confirmar).

#### Alvos de alteração

- `backend/services/comp-service/test/bdd/cucumber-context.ts` (reescrever — substituir fakes por Testcontainers + adapters reais)
- `backend/services/comp-service/test/bdd/security.steps.ts` (verificar cenário cross-tenant com banco real)
- `backend/services/comp-service/test/bdd/idempotency.steps.ts` (verificar lazy default com banco real — nenhuma row criada antes do GET)
- `backend/services/comp-service/test/bdd/layout.steps.ts` (verificar `tipo=em-branco` → 422 propagado até banco)
- `backend/services/comp-service/test/jest-bdd.json` (verificar `testTimeout` >= 120000 para container startup)
- `backend/services/comp-service/prisma/migrations/V0001_metadados/migration.sql` (verificar comentário INT-COMP-006)

#### Contrato operacional

Deve existir:
- `@testcontainers/postgresql` em `devDependencies` de `package.json` (instalado em P3 — reutilizar).
- `cucumber-context.ts` com `PostgreSqlContainer` iniciado em `beforeAll`.
- `beforeEach` truncando tabelas COMP no schema `emp_test`.
- `jest-bdd.json` com `testTimeout: 120000`.

Não deve existir:
- `fakeMetadadosRepo`, `FakeLayoutRepo`, `FakeFileStorage` no `cucumber-context.ts` após P4.
- Providers overrides usando `Map<string, Entity>` in-memory para repositórios.

Verificação objetiva:
```bash
pnpm test --config=test/jest-bdd.json 2>&1 | grep -E "(Scenarios|PASS|FAIL|passed|failed|undefined)"
# 0 undefined, 0 failed
```

#### Sequência de execução

- Fase 1: configurar `cucumber-context.ts` com Testcontainers setup/teardown; criar `BddAppModule` com adapters reais (sem fakes).
- Fase 2: adaptar `beforeEach` para truncar tabelas (não `Map.clear()`).
- Fase 3: rodar `pnpm test --config=test/jest-bdd.json` e corrigir step definitions que assumiam comportamento fake (ex.: steps que liam da Map diretamente em vez de via HTTP).
- Fase 4: verificar cenário cross-tenant em `security.steps.ts` com dois schemas reais.
- Fase 5: confirmar INT-COMP-006 no arquivo de migration.

#### Política de testes

- Integration obrigatória (toca DB real + contexto NestJS completo com HTTP).
- Pitfall `bdd-scaffold:step-definitions:duplicate-response-status-steps`: verificar `shared.steps.ts` — não duplicar steps de status HTTP. Já mitigado em P8 mas confirmar após mudança de contexto.
- Pitfall `bdd-scaffold:cucumber-expression:escaped-quote-not-supported`: já mitigado em P8 — confirmar que nenhum novo step usa aspas escapadas.

#### Multi-empresa

Obrigatório. `emp_test` é o schema de tenant principal. Cenário de cross-tenant (`security.feature`): criar `emp_test_other` schema + `projeto_editorial` row; verificar que GET/PUT com `projetoId` da outra empresa retorna 404.

#### Migrações Prisma Migrate necessárias

Não. Schema de teste é provisionado no `beforeAll` via SQL direto ou `migrate deploy`.

#### Critérios de aceite

- `pnpm test --config=test/jest-bdd.json` exits 0 com 0 undefined steps e 0 failed scenarios.
- Cenário `tipo=em-branco` → 422 (verificado em `layout.feature` contra DB real).
- Cenário lazy default → `materialized=false` sem row criada no banco (verificado em `idempotency.feature` + SELECT COUNT).
- Cenário cross-tenant → 404 (verificado em `security.feature` com dois schemas).
- Cenário `purge` (se existir em `service-boundary.feature`) → deleta via CASCADE e é idempotente.

#### Instrução para implementador

A estratégia de migração é conservadora: reutilizar o `PostgreSqlContainer` setup de P3 (extrair para `test/integration/db-setup.ts` já criado). O `cucumber-context.ts` deve importar o helper, não duplicar a lógica de container. Para o `BddAppModule`: importar `PersistenceModule` (que provê `PrismaService`) + sobrescrever os tokens COMP com os adapters reais via `{ provide: COMP_METADADOS_REPO, useClass: PrismaMetadadosRepository }`. JwtAuthGuard stub permanece — apenas os repositórios e storage precisam ser reais. Timeout: `jest.setTimeout(180000)` no `beforeAll` do container (mais lento que specs unitárias porque sobe NestJS completo).

---

## §4 Riscos

1. **Testcontainers em CI Windows** — a branch `dev` é desenvolvida em Windows 11; Testcontainers pode requerer Docker Desktop ou WSL2. O implementador deve verificar `docker info` antes de rodar P3/P4. Mitigação: se Docker não estiver disponível localmente, marcar os specs de integração com `@group integration` e configurar `--testPathIgnorePatterns` para pular em dev sem Docker.

2. **FK `projeto_editorial`** — migrations V0001-V0003 têm `REFERENCES projeto_editorial(id)`. O `db-setup.ts` deve criar essa tabela no schema `emp_test` antes de aplicar as migrations COMP (a tabela pertence ao schema PROJ). Alternativa: remover a FK no container de test e usar `DEFERRABLE INITIALLY DEFERRED` apenas em produção. Decisão: criar a tabela stub `projeto_editorial(id UUID PRIMARY KEY)` no helper de setup para desacoplar do PROJ em teste.

3. **`ManuscriptContentStubAdapter` fixture path** — `COMP_STUB_MANUSCRIPT_FIXTURE_PATH` aponta para `test/fixtures/content-tree.json`. Verificar que o arquivo existe e que o formato corresponde ao `ContentTreeDto` esperado pelo `ManuscriptContentPort.getContentTree()`. Se o formato divergir após mudanças em IMP, o BDD vai falhar em P4.

4. **Performance dos containers** — Testcontainers pode adicionar 30-60 segundos por suite. Configurar `testTimeout: 180000` em `jest-bdd.json` e `jest.setTimeout(120000)` nos specs de integração.

---

## §5 Critérios de aceite

Ao final de P2-P4, o serviço COMP deve satisfazer:

1. `pnpm test` (todos os specs — unit + integration) exits 0 com ≥ 150 tests.
2. `pnpm test --config=test/jest-bdd.json` exits 0 com 0 undefined steps e 0 failed scenarios.
3. `pnpm exec tsc --noEmit` exits 0.
4. `pnpm lint` exits 0.
5. `python scripts/arch-conformance.py check --layer be --target backend/services/comp-service` exits 0.
6. Spec com nome exato `"should reject tipo=em-branco with DomainException 422"` presente e passando.
7. Spec com nome exato `"should return default with materialized=false when repo returns null"` presente e passando.
8. `$transaction` chamado somente em `UpdateLayoutUseCase.execute()` (nunca diretamente em repositório).
9. Isolamento cross-tenant verificado: dados de `emp_test_a` não visíveis em query `emp_test_b`.
10. `purge` idempotente: chamado 2x não lança erro (verificado em spec de integração).
