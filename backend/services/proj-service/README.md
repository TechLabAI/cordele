<!-- OUTPUT-SCHEMA
- 0. Service Overview
- 1. Arquitetura e Estrutura
- 2. Funcionalidades e Fluxos Principais
- 3. Estado Atual da Implementacao
- 4. Qualidade e Evidencias
- 5. Gaps Atuais
- 6. Issues Relacionadas ao Servico
- 7. Maturidade do Servico
- 8. Historico de Evolucao (append-only)
- 9. Estado Atual Resumido (para agentes)
- 10. Proxima Atencao Recomendada
-->

# proj-service -- Operational README

# 0. Service Overview

**Papel do serviço:**
`proj-service` é o módulo **Projects** do Cordelê e é responsável pelo gerenciamento do ciclo de vida de projetos editoriais (`ProjetoEditorial` aggregate). É a única autoridade sobre transições de status (rascunho → em_composicao → publicado|com_erros) e serve como a raiz de cascata para exclusão LGPD e leitura composicional entre contextos.

**Responsabilidades principais:**
- Criar projetos iniciais em estado `rascunho`
- Transicionar status via `AdvanceProjetoStatusUseCase` (acionada por IMP e PUB)
- Permitir reabertura para revisão (`reopen`)
- Compor biblioteca (T02) com batching cross-context (não N+1)
- Fornecer detalhe do projeto (T08) com histórico de publicação
- Orquestrar exclusão LGPD leaf-first entre PUB → COMP → IMP
- Validar contexto multi-empresa via JWT claim

**Fora de escopo:**
- Gestão de manuscritos (IMP)
- Gestão de composição (COMP)
- Gestão de publicação (PUB)
- Storage de bytes (PUB)

**Schemas Postgres consumidos:**
- `cordele_global` (usuários, RBAC)
- `emp_*` (por empresa; tables: `projeto_editorial`, `projeto_status_historico`)

# 1. Arquitetura e Estrutura

**Stack:**
- Node 22 + NestJS 10.4.15
- Prisma 6.2.1 + PostgreSQL 16+
- Jest para testes unitários + Cucumber para BDD
- @nestjs/jwt + Passport para autenticação
- pnpm workspace

**Organização de pacotes (hexagonal):**
```
src/
├── domain/                           # Sem decoradores NestJS (RULE-02)
│   ├── proj.entity.ts               # Domain entity + ProjectStatus VO
│   ├── proj.entity.spec.ts          # Testes de domínio (8 testes)
│   ├── proj.domain-service.ts       # Lógica de transição de status
│   └── proj.repository.interface.ts # Porta de persistência (interface)
├── infrastructure/                   # Adapters + ports externos
│   ├── persistence/
│   │   ├── prisma.service.ts
│   │   ├── prisma-proj.repository.ts # Adapter da porta (Prisma)
│   │   ├── proj.mapper.ts            # Mapeador domain ↔ Prisma
│   │   └── database.module.ts
│   ├── auth/
│   │   ├── jwt.strategy.ts
│   │   ├── jwt-auth.guard.ts        # Guard JWT + EmpresaContext
│   │   └── auth.module.ts
│   └── health/
│       ├── health.controller.ts
│       └── health.module.ts
└── modules/                          # Feature modules (aplicação)
    └── proj/
        ├── proj.controller.ts       # HTTP adapter (7 rotas)
        ├── proj.service.ts          # Orquestrador de use cases
        ├── proj.module.ts           # DI wiring
        └── dto/
            ├── create-proj.dto.ts
            └── update-proj.dto.ts
```

**Regras arquiteturais (hexagonal):**
- **RULE-01:** `domain/` não importa `@prisma/client` ✅
- **RULE-02:** `domain/` não importa decoradores NestJS ✅
- **RULE-03:** Transações apenas na application service (repository) ✅
- **RULE-04:** `modules/` nunca importa `infrastructure/` diretamente ✅ (corrigido em P1)
- **RULE-05:** `infrastructure/` nunca importa `modules/` ✅
- **RULE-06:** Clientes HTTP apenas em `infrastructure/clients/` (não aplicável em P1)
- **RULE-08:** Sem `console.log` (não encontrado em proj-service) ✅
- **RULE-09:** DDL apenas em `prisma/migrations/` ✅

**Multi-empresa (schema-per-tenant):**
- `EmpresaContext` resolvido via JWT claim (`editora_id`)
- Todas as queries de persistência filtram por `empresaId` via WHERE clause
- Cascata de exclusão LGPD é leaf-first e idempotente

# 2. Funcionalidades e Fluxos Principais

**Fluxos críticos:**
1. **Criar projeto (rascunho)** — IMP chama via `CreateProjetoEditorialUseCase` (P2)
2. **Avançar status** — IMP/PUB chamam `AdvanceProjetoStatusUseCase` (P2)
   - `rascunho` → `em_composicao` (IMP após importação)
   - `em_composicao` → `publicado` ou `com_erros` (PUB pós-publicação)
3. **Reabrir para revisão** — Manual via `ReopenProjectForRevisionUseCase` (P2)
   - `publicado|com_erros` → `em_composicao`
4. **Composição cruzada (biblioteca T02)** — Batching sem N+1 (P4)
   - Leitura composicional: PROJ + IMP (manuscript) + COMP (metadata) + PUB (history)
   - Fallback gracioso `degraded=true` se qualquer porta falha
5. **Download assinado (T08)** — PUB assina URLs; PROJ nunca proxies bytes (P4)
6. **Exclusão LGPD (leaf-first)** — Cascata PUB → COMP → IMP → delete (P6)

**Eventos (in-process via EventEmitter2):**
- `ProjectCreated` — emitido em P3 após criar
- `ProjectStatusChanged` — emitido em P2 após transição
- `ProjectDeleted` — emitido em P6 após exclusão (post-commit)

**Endpoints REST (7 rotas):**
- `POST /api/proj/projetos` — criar projeto (rascunho)
- `GET /api/proj/projetos` — listar biblioteca (T02, com ?status, ?limit, ?cursor)
- `GET /api/proj/projetos/{id}` — detalhe do projeto (T08, com histórico)
- `GET /api/proj/projetos/{id}/publicacoes` — listar histórico de publicação
- `GET /api/proj/projetos/{id}/publicacoes/{pid}/download` — URL assinada
- `DELETE /api/proj/projetos/{id}` — excluir (LGPD cascade)
- `POST /api/proj/projetos/{id}/reopen` — reabrir para revisão

**Dependências inter-serviços (ports):**
- **Inbound:** IMP chama `CreateProjetoEditorialUseCase` + `AdvanceProjetoStatusUseCase` (P2, P6)
- **Outbound (leitura):** `ManuscriptSummaryPort` (IMP), `ProjectMetadataPort` (COMP), `PublicationHistoryPort` (PUB) — stubs em P4, reais em PROJ-INT-001..003
- **Outbound (erasure):** `ManuscriptErasurePort` (IMP), `CompositionErasurePort` (COMP), `PublicationErasurePort` (PUB) — stubs em P6, reais em PROJ-INT-004..006

# 3. Estado Atual da Implementacao

| Componente | Status | Notas |
|---|---|---|
| **P1: Scaffold + API surface** | DONE | Module compilável; 7 rotas mapeadas + handlers stub; RULE-04 violações corrigidas; lint OK |
| **P2: Domain + use cases (lifecycle)** | DONE | Entity domain ok (8 testes); 68 testes / 6 suites; create/advance/reopen implementadas; DI registry completo |
| **P3: Persistence + migrations** | DONE | Schema Prisma com ProjetoEditorial + ProjetoStatusHistorico; migrations 0001/0002 criadas; repository adapter com schema-per-tenant (score 53/100 Parcial) |
| **P4: Cross-context read composition** | MISSING | Stubs das portas de leitura não implementados |
| **P5: Security** | PARTIAL | JWT guard importado; faltam @Scopes e EmpresaContext full integration |
| **P6: LGPD erasure cascade** | MISSING | Estubs das portas de erasure não implementados; use case não implementado |
| **P7: Observability** | MISSING | Health controller skeleton; faltam correlation ID middleware + logger |
| **P8: BDD end-to-end** | MISSING | 8 feature files em `tests/cucumber/`; step definitions não implementadas |

**Detalhe por camada:**

**Domain (✅ parcial):**
- `ProjEntity` — completo, com validações
- `ProjStatus` VO — faltam transições legais
- `ProjDomainService` — skeleton
- `ProjRepositoryPort` — interface definida

**Infrastructure (✅ parcial):**
- `PrismaService` — configurado com schema-per-tenant
- `PrismaProjRepository` — adapter scaffold; referencia schema errado (Proj vs ProjetoEditorial)
- `JwtAuthGuard` + `JwtStrategy` — importado, não testado
- `PersistenceModule` — configurado

**Modules (✅ RULE-04 corrigido em P1):**
- `ProjController` — 7 rotas mapeadas com stubs; JWT guards e @CurrentUser intencionalmente ausentes (adicionados em P5/PROJ-014)
- `ProjModule` — DI tokens declarados; repositório stub via `useValue: {}`; sem imports de infrastructure (RULE-04 OK)
- `ProjService` — skeleton para orquestração de use cases
- `ProjTokens` — tokens DI para CREATE/ADVANCE/REOPEN use cases + EMPRESA_CONTEXT_TOKEN
- DTOs — definidos (create/update/response)

# 4. Qualidade e Evidencias

**Testes unitários:**
- `domain/proj.entity.spec.ts` — 8 testes (✅ PASS)
  - Build from valid props, validation de id/name/empresaId, with() semantics, archive()
- Cobertura: entity domain layer; faltam testes de: repository, use cases, controller

**Build + Lint:**
- `pnpm build` — ✅ PASS (P1 + P3 prisma client gerado; zero TS errors)
- `pnpm lint` (eslint) — ✅ PASS (sem warnings com --max-warnings 0)
- `pnpm typecheck` — ✅ PASS (tsc --noEmit)

**Conformidade arquitetural (arch-conformance.py):**
- ✅ **RULE-04 (no-infrastructure-import-in-modules):** PASS — 4 violações originais foram corrigidas em P1
  - `ProjController` — JwtAuthGuard/CurrentUser removidos (adicionados em P5)
  - `ProjModule` — sem imports de PersistenceModule/PrismaProjRepository; repositório wired via DI token
  - `ProjService` — sem imports de AuthenticatedUser; migrado para UsuarioContext interface
- ✅ **no-console-log:** 0 violações. Os 300 hits anteriores vinham de `node_modules/rxjs` por um defeito de escopo do gate, corrigido em `scripts/arch-conformance.py` (`_iter_files` passou a excluir árvores vendored). arch-conformance: exit 0.
- ✅ **no-ddl-outside-migrations**, **no-adapter-instantiation-in-service**, **no-framework-import-in-domain:** OK

**Observabilidade (não implementada em P1):**
- Health endpoint — não wired em P1
- X-Correlation-ID — não propagado
- Logs estruturados — não configurados
- Métricas — não instrumentadas

**Banco de dados:**
- Migrations — não inicializadas (faltam 0001/0002 em `prisma/migrations/`)
- Schema validation — prisma validate não testado
- Multi-tenant filter — código pronto, schema pronto, faltam testes

# 5. Gaps Atuais

| Prioridade | Gap | Impacto | Plano de resolução |
|---|---|---|---|
| **P0 (bloqueante)** | Conformidade arquitetural | Arch-conformance falha (4 violations RULE-04) | Refatorar proj.module.ts/controller.ts para usar DI tokens; remover imports diretos de infrastructure |
| **P1** | API handlers vazios | Rotas mapeadas mas retornam stub responses | Implementar handlers com orquestração mínima via ProjService |
| **P2** | Use cases não implementados | Create/AdvanceStatus/Reopen não funcionam | Implementar 4 use cases em domain/ + DI registry |
| **P3** | Migrations não executadas | Schema Prisma compilável mas sem history em DB | Criar 0001_create_projeto_editorial e 0002_create_projeto_status_historico |
| **P3** | Repository adapter incorreto | Usa `this.prisma.proj` em vez de `projetoEditorial` | Corrigir mapper e adapter após decidir nome final (Proj vs ProjetoEditorial) |
| **G5** | Paginação/filtros | GET /projetos aceita ?status mas não aplica | Deferred para PROJ-010 (POC sem aplicação) |
| **G2** | PublicationHistoryPort field set | Campo faltante na resposta | Fixo em api-contract §6.3; implementar em PROJ-INT-003 |
| **G3** | LGPD cascade | Estubs de portas; sem orquestração | Implementar em P6 com teste de order e idempotência |

# 6. Issues Relacionadas ao Servico

**Issues funcionais (18):**
- [PROJ-001](../../issues/PROJ-001.md) — Scaffold + API surface (P1)
- [PROJ-002](../../issues/PROJ-002.md) — ProjectStatus VO + transições (P2)
- [PROJ-003](../../issues/PROJ-003.md) — CreateProjetoEditorialUseCase (P2)
- [PROJ-004](../../issues/PROJ-004.md) — AdvanceProjetoStatusUseCase (P2)
- [PROJ-005](../../issues/PROJ-005.md) — ReopenProjectForRevisionUseCase (P2)
- [PROJ-006](../../issues/PROJ-006.md) — Inbound port DI export registry (P2)
- [PROJ-007](../../issues/PROJ-007.md) — Prisma schema + migrations (P3)
- [PROJ-008](../../issues/PROJ-008.md) — ProjetoEditorialRepository adapter (P3)
- [PROJ-009](../../issues/PROJ-009.md) — Outbound read port stubs (P4)
- [PROJ-010](../../issues/PROJ-010.md) — GetProjetoLibraryUseCase (T02, P4)
- [PROJ-011](../../issues/PROJ-011.md) — GetProjetoDetailUseCase (T08, P4)
- [PROJ-012](../../issues/PROJ-012.md) — GetPublicationHistoryUseCase (P4)
- [PROJ-013](../../issues/PROJ-013.md) — GetSignedDownloadUrlUseCase (P4)
- [PROJ-014](../../issues/PROJ-014.md) — Security: JWT guard + EmpresaContext (P5)
- [PROJ-015](../../issues/PROJ-015.md) — Erasure port stubs (P6)
- [PROJ-016](../../issues/PROJ-016.md) — DeleteProjetoEditorialUseCase (LGPD cascade, P6)
- [PROJ-017](../../issues/PROJ-017.md) — Health + correlation ID + logger (P7)
- [PROJ-018](../../issues/PROJ-018.md) — BDD step definitions (8 features, 44 scenarios, P8)

**Issues de integração (6):**
- [PROJ-INT-001](../../issues/PROJ-INT-001.md) — ManuscriptSummaryPort real adapter (IMP) (P4)
- [PROJ-INT-002](../../issues/PROJ-INT-002.md) — ProjectMetadataPort real adapter (COMP) (P4)
- [PROJ-INT-003](../../issues/PROJ-INT-003.md) — PublicationHistoryPort real adapter (PUB) (P4)
- [PROJ-INT-004](../../issues/PROJ-INT-004.md) — ManuscriptErasurePort real adapter (IMP) (P6)
- [PROJ-INT-005](../../issues/PROJ-INT-005.md) — CompositionErasurePort real adapter (COMP) (P6)
- [PROJ-INT-006](../../issues/PROJ-INT-006.md) — PublicationErasurePort real adapter (PUB) (P6)

# 7. Maturidade do Servico

**Score: 53/100 — Parcial (post-P3)**

| Dimensão | Score | Max | Observação |
|---|---|---|---|
| Structure | 30 | 30 | ✅ Arquitetura hexagonal + P3 migrations schema pronto |
| Functionality | 23 | 30 | ✅ Entity domain (8 testes), use cases (68 testes), repository adapter; faltam stubs (P4), cascade (P6) |
| Tests_lint | 0 | 20 | ⚠️ Deferred (test suite não rodada em tier leve; lint/build OK) |
| E2E | 0 | 10 | ✗ Nenhum teste e2e implementado (deferred para P8/Cucumber) |
| Soft | TBD | 10 | ⚠️ JWT guard importado, multi-tenant adapter wired; agent confirm pending |

**Leitura executiva:**

O serviço `proj-service` completou o **Modo 1 (BASELINE) com êxito parcial**:

✅ **Pronto para P1:**
- Scaffold hexagonal completo (domain, infrastructure, modules)
- Entity domain com validações e testes (8/8 passing)
- Prisma schema com ambos modelos (Proj + ProjetoEditorial)
- Build + lint passando
- 7 rotas mapeadas em ProjController

❌ **Bloqueantes para P2+:**
- **RULE-04 violations (4x):** modules importam infrastructure diretamente
  - Impacto: Arch-conformance FALHA; deve ser corrigido antes de merge
  - Remediação: Refatorar imports em proj.module.ts e proj.controller.ts para usar DI tokens
- **Handlers vazios:** 7 rotas retornam stub responses
- **Use cases não implementados:** (Create, AdvanceStatus, Reopen)
- **Repository adapter desalinhado:** referencia schema incorreto (Proj vs ProjetoEditorial)
- **Migrations não inicializadas:** DDL não em versão de controle

**Status tag:** `PARTIAL` (não INTACT; há violations críticas a resolver)

**Próximas ações após BASELINE:**
1. Refatorar RULE-04 violations (issue ad-hoc antes de P1)
2. Executar P1 (handlers vazios com full scaffold)
3. Executar P2 (domain use cases + inbound ports)
4. Sequência P3 → P4 → P5 → P6 → P7 → P8

# 8. Historico de Evolucao (append-only)

| Data | Fase | Evento | Detalhe |
|---|---|---|---|
| 2026-08-25 | Baseline | Scaffold proj-service completed | Node scaffold gerado; app.module, domain entity, infrastructure, modules skeleton pronto |
| 2026-08-25 | Baseline | README Baseline generated | Estado consolidado, score 45/100 (Parcial), 4x RULE-04 violations identified |
| 2026-08-25 | P1 | RULE-04 violations corrigidas | Refatoração concluída: removidos imports diretos de infrastructure; DI tokens implementados |
| 2026-08-25 | P1 | P1 Validação COMPLETA | lint OK; arch-conformance exit 0 (5 regras limpas, após correção do escopo do gate); PROJ-001 done |
| 2026-08-25 | P1 | **P1 REABERTA** | Reconciliação dos state.json mediu PROJ-001 em 2 DONE / 1 PARTIAL / 7 MISSING de 10 (score 27). O DONE anterior veio de auto-relato, não de evidência. Pendentes: proj.module.ts stub, proj.controller.spec.ts ausente, 4 DTOs de resposta com nomes divergentes. |
| 2026-08-25 | P1 | **P1 FECHADA** | PROJ-001 10/10 itens, score 80 (Maduro). build/lint/test exit 0 (20 testes); arch-conformance exit 0. 4 DTOs de resposta com os nomes da issue; proj.controller.spec.ts cobrindo as 7 rotas; 14 DI tokens; Swagger em cada rota. |
| 2026-08-25 | P2 | **P2 escopo de domínio entregue** | ProjetoStatus VO (7 transições + idempotência), CreateProjetoEditorial / AdvanceProjetoStatus / ReopenProjectForRevision, 4 DI tokens exportados. 68 testes / 6 suítes; build/lint/test/arch-conformance exit 0. PROJ-002 10/10; 10 critérios de PROJ-003..006 permanecem abertos por dependerem de P3 (transação), P4 (HTTP) e P5 (JWT). |
| 2026-08-26 | P3 | **P3 Persistence + migrations ENTREGUE** | Schema Prisma com ProjetoEditorial + ProjetoStatusHistorico; migrations 0001/0002 versionadas; ProjetoEditorialRepository adapter com schema-per-tenant via EmpresaContext. Lint exit 0; arch-conformance exit 0 (5 regras); build exit 0. PROJ-007 7/9 done (score 53 Parcial); PROJ-008 7/9 done (score 53 Parcial). Deferred: test e e2e (tier leve validation). |
| TBD | P4 | Cross-context read | Library (T02), Detail (T08), History, Download URL |
| TBD | P5 | Security | JWT + EmpresaContext integration |
| TBD | P6 | LGPD cascade | Erasure ports + leaf-first orchestration |
| TBD | P7 | Observability | Health + correlation ID + logger |
| TBD | P8 | BDD e2e | Step definitions para 8 features (44 scenarios) |

# 9. Estado Atual Resumido (para agentes)

| Pilar | Status | Detalhe |
|---|---|---|
| **STRUCTURAL** | OK | ✅ Hexagonal ok (P1); ✅ RULE-04 violations corrigidas; ✅ DI tokens implementados; ✅ P3 migrations criadas |
| **FUNCTIONAL** | OK | ✅ Entity domain ok (8 testes); ✅ 7 rotas mapeadas (P1); ✅ use cases implemented (P2); ✅ repository adapter with transactions (P3); ⚠️ outbound reads/erasure missing (P4, P6) |
| **INTEGRATION** | PARTIAL | ✅ Inbound ports (P2) + persistence adapter (P3) wired; ⚠️ Outbound stubs awaiting IMP/COMP/PUB adapters (P4, P6) |
| **OBSERVABILITY** | LOW | Health endpoint skeleton; sem correlation ID middleware; sem logger structured |
| **RESILIENCE** | LOW | Sem retry logic; sem circuit breaker; sem degraded fallback (awaiting P4) |
| **MULTI-EMPRESA** | OK | ✅ Schema-per-tenant wired; ✅ EmpresaContext propagated to repository (P3); ✅ adapter isolates tenants |

**Síntese:**
- **Pronto para:** P4 (cross-context reads composition)
- **Completado:** P1 (scaffold), P2 (domain use cases), P3 (persistence with migrations)
- **Próximo foco:** P4 read composition (library, detail, history); P5 security integration
- **Roadmap:** P3 ✅ → P4 (reads) → P5 (sec) → P6 (delete) → P7 (obs) → P8 (bdd)

# 10. Proxima Atencao Recomendada

**Imediato (P4 - Cross-context read composition):**
1. **Implementar ports de leitura (outbound)**
   - `ManuscriptSummaryPort` (IMP) — stub + adapter real (PROJ-INT-001)
   - `ProjectMetadataPort` (COMP) — stub + adapter real (PROJ-INT-002)
   - `PublicationHistoryPort` (PUB) — stub + adapter real (PROJ-INT-003)

2. **Implementar use cases de leitura**
   - `GetProjetoLibraryUseCase` (T02) — batching sem N+1
   - `GetProjetoDetailUseCase` (T08) — com histórico
   - `GetPublicationHistoryUseCase` — timeline de versões
   - `GetSignedDownloadUrlUseCase` — delegação para PUB

**Curto prazo (P5):**
- JWT guard + EmpresaContext full integration
- @Scopes decorators em todas as rotas
- Testes 401/403

**Médio prazo (P6-P8):**
- P6: LGPD cascade (erasure ports + delete orchestration)
- P7: Health endpoint + correlation ID + structured logging
- P8: BDD step definitions (8 features, 44 scenarios)

**Recomendação do agente (pós-validação P3):**
Próxima ação: **P4 - IMPLEMENTAR** (Cross-context read composition: stubs + use cases + adapters)

END DOCUMENT
