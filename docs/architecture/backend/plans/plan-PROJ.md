<!-- OUTPUT-SCHEMA
- Status das prioridades
- §0 Leitura executiva
- §1 Achados
- §2 Estrategia
- §3 Prioridades
- §4 Riscos
- §5 Criterios de aceite globais
-->

# Plano - PROJ (proj-service, Projetos Editoriais)

## Status das prioridades

- P1 -- DONE (2026-08-25) — fechada com evidencia medida do disco: PROJ-001 10/10 itens, score 80 (Maduro). Gates: build exit 0, lint exit 0, test exit 0 (20 testes, 2 suites), arch-conformance exit 0 (5 regras limpas). Foi reaberta apos a reconciliacao dos state.json mostrar 2/10 sob um DONE anterior baseado em auto-relato.
- P2 -- DONE quanto ao escopo de dominio (2026-08-25) — VO de status, 3 use cases e registry DI entregues; 68 testes / 6 suites; build, lint, test e arch-conformance todos exit 0. PROJ-002 fechada 10/10 (score 80). PROJ-003 6/10, PROJ-004 7/9, PROJ-005 5/8, PROJ-006 7/8: os 10 criterios restantes exigem transacao/historico (P3), respostas HTTP do controller (P4) e JWT (P5) — nao sao lacunas de P2.
- P3 -- pendente
- P4 -- pendente
- P5 -- pendente
- P6 -- pendente
- P7 -- pendente
- P8 -- pendente

**Tipo:** Incremental
**Resumo:** P1 DONE (2026-08-25) com PROJ-001 10/10 e score 80, verificada contra o disco. Pronto para P2 (domain use cases).

---

## §0 Leitura executiva

P1 DONE (2026-08-25), fechada com evidencia medida do disco: PROJ-001 10/10 itens, score 80 (Maduro). Scaffold hexagonal + API surface OK; domain 8/8 OK; RULE-04 corrigido; build/lint/test exit 0 (20 testes); arch-conformance exit 0, 5 regras limpas (o defeito de escopo do gate foi corrigido em `_iter_files`). P1 chegou a ser marcada DONE por auto-relato quando estava em 2/10; foi reaberta e so fechou apos medicao. Pronto para P2.

### Papel do servico

proj-service e o modulo **Projetos** do monolito modular Cordele: possui o agregado
ProjetoEditorial - a identidade a qual todos os outros contextos (IMP, COMP, PUB) se ligam -
e e a **unica autoridade** sobre o status do ciclo de vida do projeto (ADR-002). E a raiz da
cascata LGPD e a fonte da composicao de leitura cross-context que alimenta a biblioteca editorial
(T02) e a tela de historico/download (T08).

### Estado atual observado (BASELINE 2026-08-25)

Score: **45/100** (Parcial - Structure 30/30, Functionality 10/30, Tests_lint 10/20, E2E 0/10, Soft 5/10).

Gates:
- lint: OK
- build: OK
- testes domain: OK (8/8 ProjEntity)
- arch-conformance: **FAIL exit 2** - 4 violacoes RULE-04 (modules/ importando infrastructure/ diretamente)

Violacoes RULE-04 identificadas:
1. src/modules/proj/proj.controller.ts:28 importa JwtAuthGuard, CurrentUser, AuthenticatedUser de ../../infrastructure/auth/jwt-auth.guard
2. src/modules/proj/proj.module.ts:3 importa PersistenceModule de ../../infrastructure/persistence/persistence.module
3. src/modules/proj/proj.module.ts:6 importa PrismaProjRepository de ../../infrastructure/persistence/prisma-proj.repository
4. src/modules/proj/proj.service.ts:10 importa type AuthenticatedUser de ../../infrastructure/auth/jwt-auth.guard

### Continuidade da ultima rodada

Nenhuma implementacao anterior (last_implement: null). O scaffold foi gerado pela fase de
arquitetura (M2/M3). O BASELINE e o primeiro ciclo de execucao. O plano original (P1-P8) foi
redigido antes da deteccao das violacoes RULE-04 - este replanejamento incremental adiciona a
Fase 0 de correcao em P1 sem alterar a sequencia P2-P8.

### Estado multi-empresa

EmpresaContext ainda nao esta wired (gap confirmado no BASELINE). A propagacao ocorre via
AsyncLocalStorage e deve ser injetada na Fase 4 de P1 (modulo compilando) e completada em P5
(seguranca). Schemas alvo: cordele_global (autenticacao, RBAC) + emp_aetos (dados editoriais).
Nenhuma escrita de dados de empresa em cordele_global.

---

## §1 Achados

Domain puro compilando; scaffold correto; lint/build OK. Gap bloqueante: 4x RULE-04. Gaps funcionais: use cases stub, model Prisma errado, migrations ausentes, EmpresaContext nao propagado.

### Pontos fortes

- Domain puro compilando com 8/8 testes (ProjEntity) - base solida para use cases.
- Scaffold hexagonal estruturalmente correto (domain/, modules/, infrastructure/).
- build e lint passam - so as violacoes de boundaries estao bloqueando.

### Gaps e inconsistencias

- **G0 (bloqueante):** 4 violacoes RULE-04 impedem arch-conformance exit 0.
- **G1 (funcionalidade):** 7 rotas retornam stubs vazios; nenhum use case implementado.
- **G2 (model errado):** PrismaProjRepository referencia model Proj em vez de ProjetoEditorial.
- **G3 (AuthenticatedUser no dominio):** tipo de infrastructure/auth/ usado no ProjService - viola RULE-04; substituir por interface UsuarioContext em domain/shared/.
- **G4 (migrations nao versionadas):** prisma/migrations/ ausente.
- **G5 (EmpresaContext):** nao propagado para repository e ports.

### Aderencia as regras (RULE-01..09)

| Regra | Estado |
|---|---|
| RULE-01 (domain sem @prisma/client) | OK |
| RULE-02 (domain sem @nestjs) | OK |
| RULE-03 (transacoes so no application service) | OK |
| RULE-04 (modules nao importa infrastructure diretamente) | FAIL - 4 violacoes |
| RULE-05 (infrastructure nao importa modules) | OK |
| RULE-06 (HTTP clients so em infrastructure/clients) | N/A ainda |
| RULE-08 (sem console.log) | OK |
| RULE-09 (DDL so em migrations) | Pendente |

---

## §2 Estrategia

Incremental em 8 prioridades sequenciais. P1 obrigatoriamente corrige RULE-04 (gate bloqueante); P2-P8 entregam funcionalidade incremental com gates passando em cada prioridade.

### Objetivo macro

Entregar ProjModule compilavel e testavel com: ciclo de vida completo (ProjetoEditorial),
composicao de leitura cross-context batched (com degradacao graciosa), persistencia
schema-per-tenant, cascata LGPD leaf-first, seguranca JWT, e cobertura BDD - em 8 prioridades
executadas uma por vez pelo be-implement, comecando com a correcao obrigatoria de RULE-04.

### Ordem das prioridades

| P | Titulo | Motivo | Issues PROJ-NNN |
|---|---|---|---|
| P1 | Corrigir RULE-04 + API surface | Gate arch-conformance bloqueante; modulo deve compilar limpo | PROJ-001 |
| P2 | Domain + use cases (ciclo de vida) | VO de status + create/advance/reopen - base de todos os callers | PROJ-002..006 |
| P3 | Persistence + migrations | Schema Prisma, repository adapter, schema-per-tenant | PROJ-007..008 |
| P4 | Composicao de leitura cross-context | Biblioteca e detalhe; batching; degraded fallback | PROJ-009..013, PROJ-INT-001..003 |
| P5 | Seguranca | JWT guard + EmpresaContext - bloqueia testes de integracao | PROJ-014 |
| P6 | Cascata LGPD | Stubs de erasure port + DELETE orquestrado leaf-first | PROJ-015..016, PROJ-INT-004..006 |
| P7 | Observabilidade | Health endpoint + correlation ID + log degraded | PROJ-017 |
| P8 | BDD end-to-end | Step definitions para 8 features (44 cenarios) | PROJ-018 |

---

## §3 Prioridades

P1..P8 detalhadas abaixo, cada uma com objetivo, problemas, correcoes, alvos, contrato operacional, sequencia de execucao, politica de testes, multi-empresa, migracoes e criterios de aceite.

### Prioridade 1 - Corrigir RULE-04 + API surface

Status: pendente

Issues cobertas: PROJ-001

#### Objetivo

arch-conformance.py check --layer be --target backend/services/proj-service exit 0.
ProjModule compila com 7 rotas REST sob /api/proj, respostas stub. DI tokens declarados.
pnpm build exit 0.

#### Problema identificado

O scaffold viola RULE-04 em 4 pontos: modules/ importa diretamente infrastructure/auth/ e
infrastructure/persistence/. Enquanto o gate arch-conformance falhar com exit 2, nenhuma
validacao de feature pode ser concluida.

#### Correcoes mandatorias

**Fase 0 - remover todas as violacoes RULE-04 (pre-requisito bloqueante):**

A. backend/services/proj-service/src/modules/proj/proj.controller.ts
   - Remover import { CurrentUser, JwtAuthGuard, type AuthenticatedUser } de ../../infrastructure/auth/jwt-auth.guard
   - Remover @UseGuards(JwtAuthGuard) de todos os handlers (guards serao wired em P5)
   - Remover @CurrentUser() dos parametros dos handlers
   - Substituir AuthenticatedUser nos tipos por unknown nos stubs de P1

B. backend/services/proj-service/src/modules/proj/proj.module.ts
   - Remover import PersistenceModule de ../../infrastructure/persistence/persistence.module
   - Remover import PrismaProjRepository de ../../infrastructure/persistence/prisma-proj.repository
   - Remover PersistenceModule do array imports:
   - Substituir { provide: ProjRepositoryPort, useClass: PrismaProjRepository } por { provide: ProjRepositoryPort, useValue: {} }

C. backend/services/proj-service/src/modules/proj/proj.service.ts
   - Remover import type AuthenticatedUser de ../../infrastructure/auth/jwt-auth.guard
   - Criar interface UsuarioContext em src/domain/shared/usuario-context.interface.ts (id: string; empresaId: string; scopes: string[])
   - Substituir AuthenticatedUser por UsuarioContext em todos os metodos do ProjService

**Fase 1 - API surface (apos Fase 0 com arch-conformance exit 0):**
- Criar src/modules/proj/proj.tokens.ts com constantes DI para todos os use cases e ports
- Criar DTOs em src/modules/proj/dto/: CreateProjetoDto, UpdateProjetoDto, ProjetoResponseDto
- Registrar 7 rotas em ProjController conforme api-contract §4 (paths exatos, verbos HTTP)

**Fase 2 - verificacao:**
- python scripts/arch-conformance.py check --layer be --target backend/services/proj-service (exit 0)
- pnpm build (exit 0)
- pnpm lint (exit 0)

#### Alvos de alteracao (caminhos completos)

- backend/services/proj-service/src/modules/proj/proj.controller.ts
- backend/services/proj-service/src/modules/proj/proj.module.ts
- backend/services/proj-service/src/modules/proj/proj.service.ts
- backend/services/proj-service/src/modules/proj/proj.tokens.ts (criar)
- backend/services/proj-service/src/modules/proj/dto/create-projeto.dto.ts (criar)
- backend/services/proj-service/src/modules/proj/dto/update-projeto.dto.ts (criar)
- backend/services/proj-service/src/modules/proj/dto/projeto-response.dto.ts (criar)
- backend/services/proj-service/src/domain/shared/usuario-context.interface.ts (criar)

#### Contrato operacional

- Deve existir: interface UsuarioContext em src/domain/shared/ (zero imports de @nestjs ou @prisma)
- Deve existir: proj.tokens.ts exportando constantes string para todos os providers
- Nao deve existir: qualquer import de ../../infrastructure/ em arquivos de src/modules/
- Verificacao objetiva: python scripts/arch-conformance.py check --layer be --target backend/services/proj-service exit 0
- Condicao de bloqueio: exit 2 do arch-conformance impede validacao de qualquer P subsequente

#### Politica de testes

- Unit obrigatorio: spec do ProjController verificando que as 7 rotas respondem 2xx com dados stub
- Nao escrever testes de integracao em P1 (sem DB real ainda)

#### Multi-empresa

P1 nao wira EmpresaContext - apenas declara o DI token EMPRESA_CONTEXT_TOKEN em proj.tokens.ts
para que P5 possa injeta-lo. Nenhum dado de empresa e lido ou escrito em P1.

#### Migracoes Prisma Migrate

Nenhuma em P1. O schema Prisma e responsabilidade de P3.

#### Criterios de aceite

1. python scripts/arch-conformance.py check --layer be --target backend/services/proj-service exit 0
2. pnpm build exit 0
3. pnpm lint exit 0
4. Todas as 7 rotas /api/proj acessiveis (retornam stub 200/201/204)
5. Nenhum arquivo em src/modules/ importa de src/infrastructure/
6. UsuarioContext existe em src/domain/shared/ e e usado por ProjService

#### Riscos

- Provider stub { provide: ProjRepositoryPort, useValue: {} } causara erro em runtime se chamado - resolver em P3.
- Verificar se existe JwtAuthGuard compartilhado (de IMP) antes de criar novo em P5.

#### Instrucao para implementador

Executar as correcoes na ordem Fase 0 -> Fase 1 -> Fase 2. Nao avancar para Fase 1 sem
arch-conformance exit 0. UsuarioContext e um tipo puro em domain/shared/ - zero decorators,
zero imports externos. ProjController em P1 nao usa guards; @UseGuards serao adicionados em P5.

---

### Prioridade 2 - Domain + use cases (ciclo de vida)

Status: pendente

Issues cobertas: PROJ-002, PROJ-003, PROJ-004, PROJ-005, PROJ-006

#### Objetivo

ProjetoStatus VO com tabela completa de transicoes legais. Quatro use cases: criar (com evento
ProjectCreated), avancar status (idempotente + auditoria), reabrir (aresta retroativa), e
registry de inbound ports DI exportado para IMP/PUB. Todos com testes unitarios.

#### Correcoes mandatorias

- Criar src/domain/proj/projeto-status.vo.ts com enum e metodo transitionTo(next) que lanca IllegalStatusTransitionError
- Criar src/domain/proj/errors/illegal-status-transition.error.ts
- Criar src/domain/proj/ports/inbound/create-projeto.use-case.ts (interface + impl)
- Criar src/domain/proj/ports/inbound/advance-projeto-status.use-case.ts (interface + impl)
- Criar src/domain/proj/ports/inbound/reopen-projeto.use-case.ts (interface + impl)
- Registrar os 4 inbound ports em proj.tokens.ts e proj.module.ts

#### Alvos de alteracao

- backend/services/proj-service/src/domain/proj/projeto-status.vo.ts (criar)
- backend/services/proj-service/src/domain/proj/errors/illegal-status-transition.error.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/inbound/create-projeto.use-case.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/inbound/advance-projeto-status.use-case.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/inbound/reopen-projeto.use-case.ts (criar)
- backend/services/proj-service/src/modules/proj/proj.module.ts (atualizar providers)
- backend/services/proj-service/src/modules/proj/proj.tokens.ts (atualizar com tokens de use cases)

#### Contrato operacional

- Deve existir: 7 transicoes legais passando; todas as ilegais lancando IllegalStatusTransitionError
- Deve existir: advanceTo retornando { changed: false } quando status ja e o alvo (idempotencia)
- Deve existir: eventos ProjectCreated e ProjectStatusChanged com eventId UUID unico
- Nao deve existir: logica de status em ProjService ou ProjController

#### Sequencia de execucao

- Fase 1: PROJ-002 (VO - todos os use cases dependem dele)
- Fase 2: PROJ-003 + PROJ-004 (create + advance, em paralelo, mockando repository)
- Fase 3: PROJ-005 (reopen - estende o padrao de advanceTo)
- Fase 4: PROJ-006 (registry DI - wire todos os 4 providers)

#### Politica de testes

- Unit obrigatorio: spec do VO com todas as 7 transicoes legais e todas as ilegais
- Unit obrigatorio: spec de cada use case com repository mockado via jest.fn()

#### Multi-empresa

Use cases recebem UsuarioContext (dominio puro) com empresaId - o repository port propaga para
o adapter. Nenhum acesso direto a EmpresaContext nesta camada.

#### Migracoes Prisma Migrate

Nenhuma em P2.

#### Criterios de aceite

1. 7 transicoes legais passam; todas ilegais lancam IllegalStatusTransitionError
2. advanceTo com status ja existente retorna changed=false sem evento
3. Eventos emitidos com eventId UUID unico e idempotencia verificada
4. 4 inbound ports exportados via DI tokens

#### Riscos

- Use cases dependem de ProjetoEditorialRepository (P3) - testes unitarios devem usar mocks

#### Instrucao para implementador

Implementar PROJ-002 primeiro. Para PROJ-003..005, usar jest.fn() para o mock do repository.
O repository e uma interface injetada via construtor - nunca importar o adapter Prisma nos use cases.
Padrao de eventos: EventEmitter2 post-commit (listener async fora da transacao).

---

### Prioridade 3 - Persistence + migrations

Status: pendente

Issues cobertas: PROJ-007, PROJ-008

#### Objetivo

schema.prisma com models ProjetoEditorial e ProjetoStatusHistorico. Migrations iniciais
versionadas. ProjetoEditorialRepository adapter Prisma com resolucao schema-per-tenant via EmpresaContext.

#### Correcoes mandatorias

- Renomear model no schema.prisma de Proj para ProjetoEditorial
- Criar ProjetoStatusHistorico no schema.prisma com FK para ProjetoEditorial
- Gerar migrations: 0001_create_projeto_editorial e 0002_create_projeto_status_historico
- Reescrever PrismaProjRepository para usar model ProjetoEditorial e resolver schema via EmpresaContext

#### Alvos de alteracao

- backend/services/proj-service/prisma/schema.prisma
- backend/services/proj-service/prisma/migrations/0001_create_projeto_editorial/migration.sql (criar)
- backend/services/proj-service/prisma/migrations/0002_create_projeto_status_historico/migration.sql (criar)
- backend/services/proj-service/src/infrastructure/persistence/prisma-proj.repository.ts
- backend/services/proj-service/src/modules/proj/proj.module.ts (substituir stub por adapter real)

#### Contrato operacional

- Deve existir: findById retornando null para projeto de outro tenant (isolamento)
- Deve existir: updateStatus escrevendo em projeto_editorial e projeto_status_historico em uma $transaction
- Nao deve existir: DDL fora de prisma/migrations/

#### Sequencia de execucao

- Fase 1: PROJ-007 (schema + migrations - Prisma client gerado antes do adapter)
- Fase 2: PROJ-008 (adapter do repository)

#### Politica de testes

- Integration obrigatorio (toca DB): findById com tenant isolation e updateStatus com transacao

#### Multi-empresa

EmpresaContext.getEmpresaId() deve ser chamado no adapter para selecionar o schema Postgres.
Padrao identico ao imp-service (PROJ-008 referencia IMP-006 como template).

#### Migracoes Prisma Migrate

- pnpm prisma migrate dev --name create_projeto_editorial em backend/services/proj-service/
- pnpm prisma migrate dev --name create_projeto_status_historico

#### Criterios de aceite

1. pnpm prisma migrate dev cria as duas tabelas com CHECKs, FK cascade e indexes
2. findById retorna null para projeto de outro tenant
3. updateStatus grava nas duas tabelas em uma transacao

#### Riscos

- Schema-per-tenant exige PrismaClient instanciado com opcao schema de EmpresaContext; referenciar IMP-006

#### Instrucao para implementador

Adicionar models PROJ ao prisma/schema.prisma do servico. Nomes de migration devem seguir o
padrao 0001_create_projeto_editorial e 0002_create_projeto_status_historico.

---

### Prioridade 4 - Composicao de leitura cross-context

Status: pendente

Issues cobertas: PROJ-009, PROJ-010, PROJ-011, PROJ-012, PROJ-013, PROJ-INT-001, PROJ-INT-002, PROJ-INT-003

#### Objetivo

Stubs dos ports outbound de leitura (ManuscriptSummaryPort, ProjectMetadataPort, PublicationHistoryPort).
Quatro use cases de leitura: biblioteca (T02, batched, degraded), detalhe (T08), historico, URL de download.
Parametros ?status, ?limit, ?cursor reservados. Adapters reais substituem stubs apos IMP/COMP/PUB scaffolded.

#### Alvos de alteracao

- backend/services/proj-service/src/domain/proj/ports/outbound/manuscript-summary.port.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/outbound/project-metadata.port.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/outbound/publication-history.port.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/manuscript-summary.stub.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/project-metadata.stub.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/publication-history.stub.ts (criar)
- backend/services/proj-service/src/domain/proj/use-cases/get-projeto-library.use-case.ts (criar)
- backend/services/proj-service/src/domain/proj/use-cases/get-projeto-detail.use-case.ts (criar)
- backend/services/proj-service/src/domain/proj/use-cases/get-publication-history.use-case.ts (criar)
- backend/services/proj-service/src/domain/proj/use-cases/get-signed-download-url.use-case.ts (criar)
- backend/services/proj-service/src/infrastructure/clients/imp-manuscript-summary.adapter.ts (criar - PROJ-INT-001)
- backend/services/proj-service/src/infrastructure/clients/comp-project-metadata.adapter.ts (criar - PROJ-INT-002)
- backend/services/proj-service/src/infrastructure/clients/pub-publication-history.adapter.ts (criar - PROJ-INT-003)

#### Contrato operacional

- Deve existir: exatamente 3 chamadas de port por requisicao de biblioteca (invariante de batching)
- Deve existir: degraded=true quando qualquer port lanca excecao; endpoint retorna campos proprios
- Deve existir: ?status, ?limit, ?cursor aceitos por GET /projetos sem 400 (reserva G5)
- Nao deve existir: N+1 queries (cada port chamado uma vez por request com array de IDs)

#### Sequencia de execucao

- Fase 1: PROJ-009 (stubs dos ports - use cases dependem deles)
- Fase 2: PROJ-010, PROJ-011, PROJ-012, PROJ-013 (use cases, em paralelo)
- Fase 3: PROJ-INT-001..003 (adapters reais, apos modulos irmaos scaffolded)

#### Politica de testes

- Unit obrigatorio: spec com mock de port verificando contagem de chamadas (batching)
- Unit obrigatorio: spec verificando degraded=true quando port lanca

#### Multi-empresa

EmpresaContext.getEmpresaId() propagado para todos os ports e repository calls em P4.

#### Migracoes Prisma Migrate

Nenhuma em P4.

#### Criterios de aceite

1. 3 chamadas de port por request de biblioteca (verificado por mock call count)
2. degraded=true quando port lanca; endpoint responde com campos proprios
3. ?status, ?limit, ?cursor aceitos sem 400
4. Download retorna 409 para publicacoes erros_criticos|pendente

#### Riscos

- PROJ-INT-001..003 dependem de IMP/COMP/PUB scaffolded; stubs (PROJ-009) sao o fallback

#### Instrucao para implementador

Implementar PROJ-009 antes dos use cases. O invariante de batching (uma chamada por port por
request) - escrever assercao de contagem de chamadas mock explicitamente no spec. O filtro ?status
e uma clausula where no findAll; ?limit/?cursor sao aceitos mas nao aplicados no POC.

---

### Prioridade 5 - Seguranca

Status: pendente

Issues cobertas: PROJ-014

#### Objetivo

JWT guard, EmpresaContext populado a partir do claim JWT, guards de scope por endpoint. Todas
as rotas PROJ retornam 401/403 sem token valido e scope correto.

#### Alvos de alteracao

- backend/services/proj-service/src/modules/proj/proj.controller.ts (adicionar @UseGuards, @Scopes, @CurrentUser)
- backend/services/proj-service/src/modules/proj/proj.module.ts (registrar guard e estrategia JWT)
- backend/services/proj-service/src/infrastructure/auth/jwt.strategy.ts (verificar/criar)
- backend/services/proj-service/src/infrastructure/auth/jwt-auth.guard.ts (verificar/criar)

#### Contrato operacional

- Deve existir: 401 em token ausente; 403 em scope ausente
- Deve existir: EmpresaContext.getEmpresaId() derivado apenas do claim JWT
- Nao deve existir: guard duplicado se ja existir de IMP

#### Sequencia de execucao

- Fase 1: PROJ-014 (guard + EmpresaContext + decorators de scope em todas as 7 rotas)

#### Politica de testes

- Unit: spec do controller com token mockado verificando 401/403

#### Multi-empresa

EmpresaContext wired via AsyncLocalStorage do claim empresaId do JWT.

#### Migracoes Prisma Migrate

Nenhuma em P5.

#### Criterios de aceite

1. 401 em token ausente; 403 em scope ausente
2. EmpresaContext.getEmpresaId() sourced exclusivamente do JWT claim

#### Riscos

- Se JwtAuthGuard compartilhado ja existe (de IMP), reutilizar - nao duplicar

#### Instrucao para implementador

Verificar se JwtAuthGuard e ScopesGuard existem em imp-service ou shared. Se sim, aplicar ao
ProjController com @UseGuards(JwtAuthGuard, ScopesGuard) e @Scopes por rota.

---

### Prioridade 6 - Cascata LGPD

Status: pendente

Issues cobertas: PROJ-015, PROJ-016, PROJ-INT-004, PROJ-INT-005, PROJ-INT-006

#### Objetivo

Tres stubs de erasure port (PUB/COMP/IMP). DeleteProjetoEditorialUseCase orquestrando cascata
leaf-first idempotente. DELETE /projetos/{id} retornando 204 em sucesso, 502 em falha de port.
Evento ProjectDeleted emitido apos commit.

#### Alvos de alteracao

- backend/services/proj-service/src/domain/proj/ports/outbound/publication-erasure.port.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/outbound/composition-erasure.port.ts (criar)
- backend/services/proj-service/src/domain/proj/ports/outbound/manuscript-erasure.port.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/publication-erasure.stub.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/composition-erasure.stub.ts (criar)
- backend/services/proj-service/src/infrastructure/stubs/manuscript-erasure.stub.ts (criar)
- backend/services/proj-service/src/domain/proj/use-cases/delete-projeto.use-case.ts (criar)
- backend/services/proj-service/src/infrastructure/clients/pub-publication-erasure.adapter.ts (criar - PROJ-INT-006)
- backend/services/proj-service/src/infrastructure/clients/comp-composition-erasure.adapter.ts (criar - PROJ-INT-005)
- backend/services/proj-service/src/infrastructure/clients/imp-manuscript-erasure.adapter.ts (criar - PROJ-INT-004)

#### Contrato operacional

- Deve existir: ordem de purge PUB -> COMP -> IMP -> DB delete (verificada por spy call order)
- Deve existir: falha em PUB nao deleta projeto_editorial; retorna 502
- Deve existir: retry de delete parcialmente falho completa sem erro (idempotente)
- Nao deve existir: Promise.all na cascata (sequencial e abort-on-failure)

#### Sequencia de execucao

- Fase 1: PROJ-015 (stubs)
- Fase 2: PROJ-016 (use case)
- Fase 3: PROJ-INT-004..006 (adapters reais, apos modulos irmaos scaffolded)

#### Politica de testes

- Unit obrigatorio: spec verificando ordem de purge e comportamento abort-on-failure

#### Multi-empresa

EmpresaContext propagado a cada port de erasure com empresaId.

#### Migracoes Prisma Migrate

Nenhuma em P6.

#### Criterios de aceite

1. Ordem: PUB -> COMP -> IMP -> DB delete (spy call order no spec)
2. Falha em PUB: linha projeto_editorial NAO deletada; 502 retornado
3. Retry de delete parcial completa sem erro

#### Riscos

- Adapters reais (PROJ-INT-004..006) requerem ports de erasure exportados pelos modulos irmaos

#### Instrucao para implementador

Implementar PROJ-016 com try/catch estrito em cada chamada de port. Nao usar Promise.all - o
purge deve ser sequencial e parar antes do passo 4 em qualquer falha.

---

### Prioridade 7 - Observabilidade

Status: pendente

Issues cobertas: PROJ-017

#### Objetivo

GET /api/proj/health retorna 200. X-Correlation-Id propagado em todas as respostas. Entrada
WARN emitida com port=<PortName> quando degraded=true.

#### Alvos de alteracao

- backend/services/proj-service/src/modules/proj/proj.health.controller.ts (criar)
- backend/services/proj-service/src/modules/proj/correlation-id.middleware.ts (verificar/criar)
- backend/services/proj-service/src/modules/proj/proj.module.ts (registrar middleware)

#### Contrato operacional

- Deve existir: health 200 quando DB acessivel; X-Correlation-Id sempre no header de resposta
- Deve existir: WARN degraded:true port=ManuscriptSummaryPort capturado pelo spy de logger

#### Sequencia de execucao

- Fase 1: PROJ-017 (health controller + middleware de correlation ID + configuracao de logger)

#### Politica de testes

- Unit: spy no logger verificando WARN degraded:true
- Integration: health endpoint com DB real

#### Multi-empresa

Nenhuma dependencia de empresa em P7.

#### Migracoes Prisma Migrate

Nenhuma em P7.

#### Criterios de aceite

1. Health 200 quando DB acessivel
2. X-Correlation-Id sempre no header de resposta
3. WARN degraded:true port=<PortName> capturado pelo spy de logger em integration test

#### Riscos

- Ordering do middleware de correlation ID: deve rodar antes de todos os guards e use cases

#### Instrucao para implementador

Verificar se middleware de correlation ID ja existe de IMP. Se sim, registrar em ProjModule sem
duplicar. O health indicator usa @nestjs/terminus com PrismaHealthIndicator.

---

### Prioridade 8 - BDD end-to-end

Status: pendente

Issues cobertas: PROJ-018

#### Objetivo

Step definitions para todos os 8 arquivos Cucumber feature (44 cenarios). Cucumber runner exit 0
(pending aceitavel para steps que exigem infra indisponivel; error nao e aceitavel).

#### Alvos de alteracao

- backend/services/proj-service/tests/cucumber/steps/ (criar 8 arquivos de step definitions)
- backend/services/proj-service/tests/cucumber/cucumber.config.ts (verificar/criar)

#### Contrato operacional

- Deve existir: Cucumber runner exit 0 para todos os 8 features
- Deve existir: spy de logger capturando WARN degraded:true port=<PortName> nos cenarios SPEC-07
- Deve existir: mock call count = 1 nos cenarios de biblioteca batched

#### Sequencia de execucao

- Fase 1: PROJ-018 (todos os 8 arquivos de step definitions + config do cucumber)

#### Politica de testes

- BDD obrigatorio: todos os 44 cenarios executados; pending aceitavel, error nao

#### Multi-empresa

Step definitions passam empresaId nos headers de request ou via fixture de contexto.

#### Migracoes Prisma Migrate

Nenhuma em P8.

#### Criterios de aceite

1. pnpm test Cucumber runner exit 0 para todos os 8 features
2. Spy de logger captura WARN degraded:true port=<PortName>
3. Mock call count = 1 para cenarios de biblioteca batched

#### Riscos

- Cenarios SPEC-07 (logging) sao BDD nao-padrao; step defs devem usar jest.spyOn(logger, 'warn')

#### Instrucao para implementador

Referenciar avisos do handoff M2.5: SPEC-07 cls 3/5 requerem spy de logger; SPEC-10 cls 3 requer
assercao de call count de port. Implementar esses padroes antes dos cenarios HTTP/status diretos.

---

## §4 Riscos

| Risco | Mitigacao |
|---|---|
| Provider stub useValue {} causa erro em runtime se chamado | Stubs P1 respondem antes de chegar ao repo; resolver em P3 |
| Guard duplicado (JwtAuthGuard ja existe em IMP) | Verificar antes de criar em P5; reutilizar se existir |
| Adapters reais PROJ-INT-001..006 dependem de modulos irmaos | Stubs cobrem o gap durante desenvolvimento paralelo de PROJ |
| Middleware de correlation ID duplicado | Verificar existencia em IMP antes de criar em P7 |
| Cenarios BDD SPEC-07 (logger spy) nao-padrao | Implementar spy pattern antes dos cenarios HTTP simples em P8 |

---

## §5 Criterios de aceite globais

1. python scripts/arch-conformance.py check --layer be --target backend/services/proj-service exit 0 (apos P1)
2. pnpm build exit 0 em todas as prioridades
3. pnpm lint exit 0 em todas as prioridades
4. pnpm test exit 0 com 8/8 testes domain + specs unitarios de todos os use cases
5. 7 rotas REST /api/proj funcionando com respostas corretas (apos P2+P3)
6. Batching invariant: 3 chamadas de port por request de biblioteca (apos P4)
7. 401/403 corretos em rotas protegidas (apos P5)
8. Cascata LGPD na ordem PUB->COMP->IMP->DB (apos P6)
9. Health 200 + correlation ID em todos os responses (apos P7)
10. Cucumber runner exit 0 para 44 cenarios (apos P8)

---

## Dependencias externas

- IMP module: exporta ManuscritoQueryPort (PROJ-INT-001) e ManuscritoErasurePort (PROJ-INT-004)
- COMP module: exporta MetadataQueryPort (PROJ-INT-002) e MetadataErasurePort (PROJ-INT-005)
- PUB module: exporta PublicacaoQueryPort + FileStoragePort (PROJ-INT-003) e PublicacaoErasurePort (PROJ-INT-006)
- Shared EmpresaContext, JwtAuthGuard, ScopesGuard: verificar existencia de IMP antes de criar

---

## Restricoes arquiteturais (node stack)

- modules/ importa apenas domain/ (ports, VOs, errors) e providers via DI tokens - nunca infrastructure/ diretamente (RULE-04)
- domain/ nao importa @prisma/client nem @nestjs/common decorators (RULE-01, RULE-02)
- Transacoes $transaction apenas no infrastructure/persistence (RULE-03)
- EmpresaContext resolvido apenas do JWT claim (nunca body/path/query)
- Emissao de eventos pos-commit (EventEmitter2 async listener, fora de transacao)

---

## Referencias

- docs/architecture/backend/services/proj-service/contracts/api-contract.md (§4, §6, §7)
- docs/architecture/backend/services/proj-service/contracts/data-model.md
- docs/architecture/backend/services/proj-service/contracts/integration-contracts.md
- docs/architecture/backend/services/proj-service/contracts/event-contracts.md
- docs/architecture/backend/services/proj-service/spec/backend/SPEC-01..11
- docs/architecture/backend/services/proj-service/tests/cucumber/ (8 feature files)
- docs/architecture/backend/adr/ADR-001-hexagonal-node.md
- docs/architecture/backend/adr/ADR-002-modular-monolith.md
- docs/architecture/backend/adr/ADR-003-multi-tenancy.md
- docs/architecture/backend/services/proj-service/adr/ADR-001-service-boundary.md
- docs/architecture/backend/services/proj-service/adr/ADR-002-project-status-authority.md
- docs/architecture/backend/services/proj-service/adr/ADR-003-publication-history-read-model.md
- docs/architecture/backend/plans/plan-IMP.md (referencia de padroes de implementacao)
- docs/architecture/backend/standards/node-hexagonal-patterns.md
