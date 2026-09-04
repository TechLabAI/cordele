# Plano FE — PUB (Publicação) — cordele-web

> Gerado por: /fe-planner · 2026-08-31
> Atualizado por: /fe-planner · 2026-09-04 (INCREMENTAL — P6-P9 destrinchadas; score 82/100 MADURO; 27/34 done)
> Tipo original: REPLANEJAMENTO COMPLETO | Atualização: INCREMENTAL ESPECÍFICO (P6-P9)
> Módulo: PUB · Microservice: pub-service · Nx libs target: libs/pub/{shell-entry,navigation,integration,data-access,feature-export,ui,feature-history,access}

## Status das prioridades

- P1 — Foundation — **DONE** (score 82; todas as 6 issues FE-PUB-001..006 entregues)
- P2 — Data Access — **DONE** (FE-PUB-007..011 entregues; PublicacaoApiService, ExportFacade, HistoryFacade operacionais)
- P3 — Feature Libs — **DONE** (FE-PUB-012..020; T07+T08 sem mocks, sub-libs feature-export/ui/feature-history criadas)
- P4 — Hub Integrations — **DONE** (INT-FE-PUB-001..006; INT-004 e INT-005 fechadas em 2026-09-03)
- P5 — Access Guards — **DONE** (FE-PUB-021..022; pubProjetoGuard + pubStatusGuard operacionais)
- P6 — Navigation / Breadcrumbs — **pendente** (FE-PUB-023)
- P7 — UX Polish — **pendente** (FE-PUB-024, FE-PUB-025)
- P8 — Observability — **pendente** (FE-PUB-026)
- P9 — E2E + Hardening — **pendente** (FE-PUB-027, FE-PUB-028)

---

## 0. Leitura executiva do estado atual

### Papel do módulo FE

PUB é o passo final do pipeline editorial do Cordelê: dado um projeto em `em_composicao`, o usuário dispara a geração do ePub via `pub-service`, acompanha o build via poll limitado (POST 202 + GET status com Retry-After, sem SSE e sem setInterval — ADR-PUB-001), recebe o veredito epubcheck server-authoritative (`valido`/`avisos` → download habilitado; `erros_criticos` → bloqueado) e consulta o histórico de publicações. PUB não é um landing module: toda entrada chega com `projetoId` originado de COMP (T06 "Exportar") ou PROJ.

### Estado atual observado

Score ES: **82/100** (Maduro). Última validação: `2026-09-03T20:23:32Z`. Último impl: remoção do flat lib morto `@cordele/pub` (`2026-09-04T20:04:25Z`). 27/34 issues DONE. Gates: lint=PASS, test=PASS, build=PASS, arch-conformance=PASS.

Sub-libs arquiteturais todas criadas: `libs/pub/{shell-entry,navigation,integration,data-access,feature-export,ui,feature-history,access}`. `pub-e2e` app scaffoldado. Backend real operacional em `http://localhost:3002/api/v1/pub`. Base URL centralizada em `@cordele/shared/access-http-base`. Flat lib `@cordele/pub` removido.

**Estado factual de P6-P9:**
- `PUB_NAV_CONFIG` existe (stageIndex: 3) mas não foi registrada no `NavigationService` (`start()` é no-op; stop() tem stub de breadcrumb flush).
- Loading/error states implementados; `traceId` (X-Correlation-Id) **não exibido** em nenhum bloco de erro — SPEC-07 §4 pendente.
- "inválido" e botão disabled existem para rows `erros_criticos`; toast de URL expirada não emitido no primeiro re-fetch (só na segunda falha).
- `publishBreadcrumb` não implementado; `@cordele/shared/observability` é apenas interface stub.
- E2E: 26 cenários em `test.skip()` — todos por implementar.

**Discrepância de contagem (27 vs 28):** O validador registra 27/34 DONE em vez de 28 (P1-P5 = 28 issues). A discrepância vem do known pitfall `fe-issue-generator:checklist-emoji-markers` — o `plan-state-extractor.py` não parseia marcadores 🔲/✅. Nenhuma issue de P1-P5 está factualmente pendente; a análise de código confirma P1-P5 implementadas. As 7 issues pendentes reais são FE-PUB-023..028 (6 issues) mais provavelmente uma das issues de P3 contada como aberta pelo extrator.

### Continuidade da última rodada

P5 concluída (`2026-09-01`); INT-FE-PUB-004 e INT-FE-PUB-005 fechadas em `2026-09-03`. Remoção do flat lib `@cordele/pub` em `2026-09-04`. Próximas: P6 (Navigation), P7 (UX Polish), P8 (Observability), P9 (E2E).

### Diagnóstico executivo

Tipo de planejamento desta atualização: **INCREMENTAL ESPECÍFICO** — P6-P9 destrinchadas com DoD executável; P1-P5 preservadas como DONE.

### Multi-empresa: @cordele/shared/access-http-base

PUB emite HTTP (trigger export, poll status, list history, get signed URL). O `PublicacaoHttpAdapter` em `libs/pub/src/lib/api/publicacao-http.adapter.ts` **deve** usar `@cordele/shared/access-http-base` como base de injeção de HttpClient. O interceptor de empresa (`EmpresaInterceptor`) deve estar declarado nos providers antes de `providePub({ adapter: 'http' })`. Verificar em P2 que o adapter herda/injeta via `@cordele/shared/access-http-base` e não usa `HttpClient` raw sem interceptor.

---

## 1. Principais achados

### Pontos fortes

- `libs/pub/` flat lib criada pelo promote: contém tipos, facades, adapters, guards stub, componentes smart, routes — base sólida para evoluir para as sub-libs sem partir do zero.
- `export.facade.ts`: bounded poll sem setInterval, MAX_POLLS=60, `podeBaixar` computed corretamente (valido|avisos AND arquivoDisponivel) — conforme ADR-PUB-001 e SPEC-03.
- `pub.routes.ts` já registrado em `app.routes.ts` e `sidebar.component.ts` — PUB acessível pelo shell.
- `pub.models.ts` alinhado ao api-contract §6.1–6.3 e §4.4 (SignedDownloadUrl) — sem drift.
- `pub.providers.ts` com factory mock/http — padrão correto para alternância de adapter.

### Gaps (ativos — P6-P9)

1. **P6 — NavigationService não registrado**: `PUB_NAV_CONFIG` existe mas `PubShellIntegrationService.start()` é no-op; `stop()` tem stub de breadcrumb flush. Breadcrumbs dinâmicos com `{nomeProjeto}` não implementados.
2. **P7 — traceId não exibido**: `ExportFacade.error()` e `HistoryFacade.downloadError()` não expõem `errorTraceId` signal; SPEC-07 §4 não coberta.
3. **P7 — toast ausente no re-fetch**: `ArtifactDownloadService._refetchAndOpen()` re-fetcha silenciosamente; toast "O link expirou" só aparece como mensagem de erro na segunda falha (não como toast na primeira).
4. **P8 — publishBreadcrumb ausente**: `PubShellIntegrationService` não tem o método; `@cordele/shared/observability` é apenas interface stub sem classe injetável.
5. **P9 — 26 cenários em test.skip()**: todos os E2E implementados como stubs; nenhum exercita o app real.
6. **P9 — nenhum gate cobre URLs reais**: lint/test/arch-conformance não detectam path errado no adapter; gap fechado por `smoke.spec.ts` (requisito de primeira classe).

### Pontos fortes (P1-P5 entregues)

- Todas as 8 sub-libs arquiteturais criadas e buildando.
- Guards `pubProjetoGuard` e `pubStatusGuard` operacionais com testes parametrizados.
- `ExportFacade`: bounded poll, MAX_POLLS=60, `podeBaixar` computed, cancelamento por empresa switch via token `PUB_EMPRESA_CHANGED`.
- `PublicacaoApiService` com base URL via `@cordele/shared/access-http-base` (`/api/v1/pub`) — 9 guards de regressão de prefixo ativos.
- INT-FE-PUB-004 e INT-FE-PUB-005 entregues: lista de avisos (contagens) e KPIs de ePub (null-safe).
- Flat lib `@cordele/pub` removido; zero referências residuais.

### Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | INT-FE-PUB-004 bloqueada indefinidamente por PUB-016 BE | FE-PUB-016 entrega contagens apenas; UI extensível quando desbloqueado |
| R2 | INT-FE-PUB-005 sem decisão de produto (KPIs de ePub) | EpubSummaryGridComponent null-safe; tiles ocultados (nunca fabricados) |
| R3 | Mocks residuais do protótipo ativos em produção | Checklist explícito em FE-PUB-012 e FE-PUB-018; testes unitários verificam ausência de setInterval e referências a mock-data |
| R4 | Divergência de tokens CSS entre protótipo promovido e theme.css do app | Gate de tokens em P3 antes de promover T07/T08 |

### Aderência às regras Nx (boundaries, tax-map, naming)

- Tags obrigatórias por sub-lib: `scope:pub` + type conforme tabela abaixo.
- Flat lib `libs/pub/` atual tem `scope:pub` + `type:feature` — será substituída pelas sub-libs; o flat lib permanece como base transitória para P1 e é refatorado nas waves P2–P3.
- Imports cross-scope permitidos apenas via barrel público (`@cordele/<lib>`), nunca via path direto.

---

## 2. Estratégia geral

### Objetivo macro

Evoluir o flat lib deliver do `fe-architect-promote` para a estrutura de sub-libs arquiteturais definida pelo backlog, wave por wave, sem interromper o `app.routes.ts` em produção. Prioridade absoluta: P1 (Foundation) que desbloqueia a cadeia inteira e o fe-implement.

### Decisão arquitetural sobre "pub-shell-entry" (ambiguidade resolvida)

**`pub-shell-entry` é o Nx project name da sub-lib `libs/pub/shell-entry/`**, que ainda não existe. O flat lib `libs/pub/` (project name `pub`) foi entregue pelo promote como scaffold; ele **não é** o shell-entry. A estratégia é:

1. Criar `libs/pub/shell-entry/` com `nx g @nx/angular:library` — esta lib recebe o contrato, as rotas completas, o descriptor e o bootstrap.
2. Atualizar `app.routes.ts` para importar `PUB_ROUTES` de `@cordele/pub-shell-entry` (não mais de `@cordele/pub`).
3. O flat `libs/pub/` (`@cordele/pub`) mantém seus exports existentes (facades, port, models, providers) e serve de base para P2 migração para `libs/pub/data-access/`.
4. Criar `libs/pub/navigation/` em P1 para FE-PUB-005 (PUB_NAV_CONFIG).
5. Criar `libs/pub/integration/` em P1 para FE-PUB-006 (PubShellIntegrationService).

### Ordem das prioridades

| P | Título | Motivo | Issues cobertas |
|---|---|---|---|
| P1 | Foundation | Desbloqueia toda a cadeia; shell-entry, routes completas, descriptor, bootstrap | FE-PUB-001..006 |
| P2 | Data Access | Serviços e facades prontos para feature libs consumirem | FE-PUB-007..011 |
| P3 | Feature Libs | T07 e T08 promovidos sem mocks, consumindo P2 real | FE-PUB-012..020 |
| P4 | Hub Integrations | Interceptors, cross-context PROJ/COMP, gaps bloqueados documentados | INT-FE-PUB-001..006 |
| P5 | Access Guards | Guards UUID + status operacionais | FE-PUB-021..022 |
| P6 | Navigation / Breadcrumbs | `PubShellIntegrationService.start()` registra `PUB_NAV_CONFIG` no NavigationService; breadcrumbs dinâmicos T07/T08 | FE-PUB-023 |
| P7 | UX Polish | traceId em todos erros (SPEC-07 §4); toast de URL expirada no primeiro re-fetch; teste do gate disabled/inválido | FE-PUB-024, FE-PUB-025 |
| P8 | Observability | `publishBreadcrumb` via `ObservabilityService` + token `PUB_BREADCRUMB`; sem console.log | FE-PUB-026 |
| P9 | E2E + Hardening | smoke test contra backend real; 26 cenários Playwright com route intercept | FE-PUB-027, FE-PUB-028 |

---

## 3. Plano por prioridade

---

### Prioridade P1 — Foundation

**Status:** pendente
**Issues cobertas:** FE-PUB-001, FE-PUB-002, FE-PUB-003, FE-PUB-004, FE-PUB-005, FE-PUB-006
**Categoria:** ESTRUTURAL

#### Objetivo

Criar as 3 sub-libs de estrutura (shell-entry, navigation, integration) e registrar PUB no Shell com contrato, rotas completas (com todos os guards de SPEC-01), descriptor, bootstrap e serviço de integração. Ao final, `npx nx build pub-shell-entry` PASS e PUB navega corretamente no shell.

#### Problema

- `libs/pub/shell-entry/`, `libs/pub/navigation/`, `libs/pub/integration/` não existem.
- `pub.routes.ts` no flat lib não declara `authGuard`, `empresaGuard` nem `accessGuard` (guards parciais).
- `pub.contract.ts`, `pub.descriptor.ts`, `pub.bootstrap.ts` e `PUB_NAV_CONFIG` ausentes.
- PUB_MODULE_DESCRIPTOR não registrado em `module-descriptors.ts`.
- app.routes.ts importa `PUB_ROUTES` de `@cordele/pub` (flat lib) — deve migrar para `@cordele/pub-shell-entry`.

#### Resultado esperado

- 3 novas Nx libs criadas e buildando.
- PUB registrado no shell com `PUB_MODULE_DESCRIPTOR` em `module-descriptors.ts`.
- Rotas SPEC-01 completas com todos os guards.
- `PubShellIntegrationService` ouve empresa switch e cancela poll em andamento.
- `app.routes.ts` e `app.config.ts` atualizados para usar `@cordele/pub-shell-entry`.

#### Arquivos-alvo

**Criar — `libs/pub/shell-entry/` (novo projeto Nx)**

- `frontend/libs/pub/shell-entry/src/lib/pub.contract.ts`
- `frontend/libs/pub/shell-entry/src/lib/pub.descriptor.ts`
- `frontend/libs/pub/shell-entry/src/lib/pub.bootstrap.ts`
- `frontend/libs/pub/shell-entry/src/lib/pub.routes.ts` (nova versão com guards completos)
- `frontend/libs/pub/shell-entry/src/index.ts`
- `frontend/libs/pub/shell-entry/project.json`

**Criar — `libs/pub/navigation/` (novo projeto Nx)**

- `frontend/libs/pub/navigation/src/lib/pub-nav.config.ts` (PUB_NAV_CONFIG, stageIndex: 3)
- `frontend/libs/pub/navigation/src/index.ts`
- `frontend/libs/pub/navigation/project.json`

**Criar — `libs/pub/integration/` (novo projeto Nx)**

- `frontend/libs/pub/integration/src/lib/pub-shell-integration.service.ts`
- `frontend/libs/pub/integration/src/index.ts`
- `frontend/libs/pub/integration/project.json`

**Atualizar**

- `frontend/apps/cordele-web/src/app/app.routes.ts` — mudar import de `@cordele/pub` → `@cordele/pub-shell-entry`
- `frontend/apps/cordele-web/src/app/module-descriptors.ts` (ou equivalente no shell) — adicionar PUB_MODULE_DESCRIPTOR
- `frontend/libs/pub/src/index.ts` — remover re-export de PUB_ROUTES (evitar duplicidade após migração)

#### Contrato de tipo

```typescript
// pub.contract.ts
export const MODULE_KEY = 'pub' as const;

export const PUB_MENU_METADATA: ModuleMenuMetadata = {
  label: 'Publicação',
  icon: 'publish',
  order: 40,
  section: 'projeto',
  route: '/pub',
  isHome: false,
};

export const PUB_PERMISSION_MAP: ModulePermissionMap = {
  'pub.view':     { scope: 'pub:read',  description: 'Visualizar publicações e histórico' },
  'pub.export':   { scope: 'pub:write', description: 'Disparar nova geração de ePub' },
  'pub.download': { scope: 'pub:read',  description: 'Baixar arquivo ePub via signed URL' },
};

export const PUB_FEATURE_FLAGS: ModuleFeatureFlags = {
  'pub.rexport':   { defaultState: 'on'  },
  'pub.pdfExport': { defaultState: 'off' }, // fora do MVP — não implementar
};

// pub-nav.config.ts
export const PUB_NAV_CONFIG: NavConfig = {
  moduleKey: 'pub',
  stageIndex: 3,         // step-bar: Projetos(0) → Importar(1) → Compor(2) → Exportar(3)
  stageLabel: 'Exportar',
  breadcrumbLabel: 'Publicação',
};
```

#### Sequência de execução

1. **Generators Nx** — criar as 3 sub-libs:
   ```bash
   npx nx g @nx/angular:library --directory=libs/pub/shell-entry \
     --name=pub-shell-entry --standalone --buildable \
     --tags="scope:pub,type:shell-entry"
   npx nx g @nx/angular:library --directory=libs/pub/navigation \
     --name=pub-navigation --standalone --buildable \
     --tags="scope:pub,type:util"
   npx nx g @nx/angular:library --directory=libs/pub/integration \
     --name=pub-integration --standalone --buildable \
     --tags="scope:pub,type:feature"
   ```
2. **FE-PUB-001** — criar `pub.contract.ts` em shell-entry com MODULE_KEY, PUB_MENU_METADATA, PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS.
3. **FE-PUB-005** — criar `pub-nav.config.ts` em navigation com PUB_NAV_CONFIG (stageIndex: 3).
4. **FE-PUB-006** — criar `PubShellIntegrationService` em integration: `start()` assina `EmpresaContext.activeEmpresa$` e emite sinal `empresaChanged`; `stop()` unsubscribe e flush breadcrumbs.
5. **FE-PUB-002** — criar `pub.routes.ts` em shell-entry com PUB_ROUTES completas: guards `[authGuard, empresaGuard, accessGuard('pub.view|pub.export')]` + `pubProjetoGuard` + `pubStatusGuard('export'|'history')`. Imports de guards vêm de `@cordele/pub` (flat lib) até que `libs/pub/access/` exista em P5.
6. **FE-PUB-003** — criar `pub.descriptor.ts` (PUB_MODULE_DESCRIPTOR) e `pub.bootstrap.ts` (`init`/`destroy`) em shell-entry.
7. **FE-PUB-004** — adicionar `PUB_MODULE_DESCRIPTOR` em `module-descriptors.ts` no shell.
8. Atualizar `app.routes.ts` — substituir `import('@cordele/pub')` por `import('@cordele/pub-shell-entry')`.
9. Atualizar `libs/pub/src/index.ts` — remover export de `PUB_ROUTES` (migrado para shell-entry).

#### Generators Nx obrigatórios

```bash
npx nx g @nx/angular:library --directory=libs/pub/shell-entry \
  --name=pub-shell-entry --standalone --buildable \
  --tags="scope:pub,type:shell-entry"

npx nx g @nx/angular:library --directory=libs/pub/navigation \
  --name=pub-navigation --standalone --buildable \
  --tags="scope:pub,type:util"

npx nx g @nx/angular:library --directory=libs/pub/integration \
  --name=pub-integration --standalone --buildable \
  --tags="scope:pub,type:feature"
```

#### Política de testes

- Unit obrigatório: `npx nx test pub-shell-entry` — verificar que PUB_PERMISSION_MAP tem exatamente `pub.view`, `pub.export`, `pub.download`; que `pub.pdfExport.defaultState === 'off'`; que PUB_NAV_CONFIG.stageIndex === 3.
- `npx nx test pub-integration` — verificar que `start()` assina empresa e que `stop()` cancela assinatura (spy).
- E2E não requerido em P1.

#### Multi-empresa

`PubShellIntegrationService` assina `EmpresaContext.activeEmpresa$` de `@cordele/shared/empresa-context`. Ao trocar empresa, emite `empresaChanged` para que o `ExportFacade` cancele o poll em andamento (signal consumido na facade em P2). Não usa HttpClient.

#### Critérios de aceite

```bash
npx nx build pub-shell-entry   # exit 0
npx nx lint pub-shell-entry    # exit 0
npx nx test pub-shell-entry    # exit 0; PUB_PERMISSION_MAP.keys === ['pub.view','pub.export','pub.download']
npx nx build pub-navigation    # exit 0
npx nx build pub-integration   # exit 0
npx nx build cordele-web       # exit 0 (app.routes.ts atualizado)
```

Verificação funcional:
- PUB_MODULE_DESCRIPTOR.key === 'pub' registrado em module-descriptors.ts
- `PUB_NAV_CONFIG.stageIndex === 3`
- `PUB_FEATURE_FLAGS['pub.pdfExport'].defaultState === 'off'`

#### Instrução para o implementador

Antes de criar qualquer arquivo, rodar os 3 generators Nx acima. O projeto `pub-shell-entry` é o destino de FE-PUB-001..004. Não reutilizar o flat lib `libs/pub/` como destino — ele mantém facades, models e adapters para P2. A `pub.routes.ts` em shell-entry é a versão definitiva com guards completos; a do flat lib é removida do index.ts mas não do disco (não apagar — o flat lib inteiro será refatorado em P2/P3 por wave). Ao atualizar `app.routes.ts`, confirmar que o path `'pub'` com `loadChildren` aponta para `@cordele/pub-shell-entry` e que `PUB_ROUTES` ainda é o export correto.

---

### Prioridade P2 — Data Access

**Status:** pendente
**Issues cobertas:** FE-PUB-007, FE-PUB-008, FE-PUB-009, FE-PUB-010, FE-PUB-011
**Categoria:** FUNCIONAL

#### Objetivo

Criar `libs/pub/data-access/` (novo Nx lib) e popular com os serviços de I/O: `PublicacaoApiService`, `ArtifactDownloadService`, `ExportFacade` refinada, `HistoryFacade`, e `error-mapping`. O flat lib `libs/pub/` existente tem versões draft de facades, port e adapters — migrar para `data-access` e refinar com os contratos completos de SPEC-04.

#### Arquivos-alvo

**Criar — `libs/pub/data-access/` (novo projeto Nx)**

- `frontend/libs/pub/data-access/src/lib/publicacao-api.service.ts`
- `frontend/libs/pub/data-access/src/lib/artifact-download.service.ts`
- `frontend/libs/pub/data-access/src/lib/export.facade.ts` (migrar + refinar do flat lib)
- `frontend/libs/pub/data-access/src/lib/history.facade.ts` (migrar do flat lib)
- `frontend/libs/pub/data-access/src/lib/error-mapping.ts` (AppError URN → msg pt-BR)
- `frontend/libs/pub/data-access/src/lib/api/` (port + adapters migrados do flat lib)
- `frontend/libs/pub/data-access/src/lib/models/pub.models.ts` (migrado do flat lib)
- `frontend/libs/pub/data-access/src/index.ts`

**Atualizar**

- `frontend/libs/pub/src/index.ts` — adicionar re-export de `@cordele/pub-data-access` para itens migrados (compat transitória) e remover exports originais dos migrados
- Dependência: `PublicacaoHttpAdapter` deve injetar HttpClient via `@cordele/shared/access-http-base`

#### Generators Nx obrigatórios

```bash
npx nx g @nx/angular:library --directory=libs/pub/data-access \
  --name=pub-data-access --standalone --buildable \
  --tags="scope:pub,type:data-access"
```

#### Critérios de aceite

```bash
npx nx test pub-data-access    # exit 0; ExportFacade poll funcional com mocks HTTP; HistoryFacade carrega
npx nx lint pub-data-access    # exit 0
npx nx build pub-data-access   # exit 0
```

#### Instrução para o implementador

`PublicacaoApiService` implementa as chamadas de SPEC-04 §1 (trigger, getStatus, listByProjeto, getStats, getProjetoHeader, getAutor). `ArtifactDownloadService` obtém signed-URL via §4.4 e abre URL no browser — nunca faz proxy de bytes. `ExportFacade` refinada: integrar sinal `empresaChanged` de `PubShellIntegrationService` (cancelar poll ao trocar empresa). Declarar `isMock: false` quando o adapter for 'http'. O adapter HTTP usa HttpClient fornecido via `@cordele/shared/access-http-base` (RULE-NX: sem import direto de `HttpClientModule`).

---

### Prioridade P3 — Feature Libs

**Status:** pendente
**Issues cobertas:** FE-PUB-012, FE-PUB-013, FE-PUB-014, FE-PUB-015, FE-PUB-016, FE-PUB-017, FE-PUB-018, FE-PUB-019, FE-PUB-020
**Categoria:** FUNCIONAL

#### Objetivo

Criar `libs/pub/feature-export/`, `libs/pub/ui/` e `libs/pub/feature-history/`. Promover T07 e T08 do flat lib para as libs corretas, removendo TODOS os mocks residuais do protótipo (setInterval, AVISOS_MOCK, "Simular estado"). Os componentes smart consomem facades de `@cordele/pub-data-access` (P2).

#### Generators Nx obrigatórios

```bash
npx nx g @nx/angular:library --directory=libs/pub/feature-export \
  --name=pub-feature-export --standalone --buildable \
  --tags="scope:pub,type:feature"
npx nx g @nx/angular:library --directory=libs/pub/ui \
  --name=pub-ui --standalone --buildable \
  --tags="scope:pub,type:ui"
npx nx g @nx/angular:library --directory=libs/pub/feature-history \
  --name=pub-feature-history --standalone --buildable \
  --tags="scope:pub,type:feature"
```

#### Critérios de aceite

```bash
npx nx test pub-feature-export   # exit 0; sem referência a setInterval, AVISOS_MOCK nem mock-data
npx nx test pub-feature-history  # exit 0; sem referências a mock-data
npx nx lint pub-feature-export   # exit 0
npx nx lint pub-feature-history  # exit 0
npx nx build cordele-web         # exit 0
```

Pitfall D-621: verificar que o promote não vendorizou `node_modules/` ou `.angular/dist` — se a lib flat tiver artefatos de build, ignorar e trabalhar apenas com `.ts` source.

Pitfall `fe-architect-promote:app-theme`: antes de promover T07/T08, listar todas as classes CSS usadas pelos componentes e verificar que existem em `frontend/apps/cordele-web/src/theme.css`. Se houver token ausente, adicioná-lo ao `theme.css` antes de prosseguir.

#### Instrução para o implementador

FE-PUB-016 (WarningsDetailsComponent): entregar contagens apenas (totalErros, totalAvisos, resumoErro) — lista detalhada BLOQUEADA por INT-FE-PUB-004. FE-PUB-015 (EpubSummaryGrid): tiles de KPI omitidos quando null — BLOQUEADA por INT-FE-PUB-005. Não fabricar dados nem omitir silenciosamente — o componente deve renderizar estado vazio explícito.

---

### Prioridade P4 — Hub Integrations

**Status:** pendente
**Issues cobertas:** INT-FE-PUB-001, INT-FE-PUB-002, INT-FE-PUB-003, INT-FE-PUB-004 (BLOQUEADA), INT-FE-PUB-005 (BLOQUEADA), INT-FE-PUB-006
**Categoria:** WIRING

#### Objetivo

Validar que os interceptors de `@cordele/shared/access-http-base` estão declarados antes de `providePub({ adapter: 'http' })` em `app.config.ts`. Implementar cross-context PROJ (`getProjetoHeader`) e COMP (`getAutor`) como calls lazy na HistoryFacade. Documentar formalmente INT-FE-PUB-004 e INT-FE-PUB-005 como bloqueadas com suas dependências externas.

#### Arquivos-alvo

- `frontend/apps/cordele-web/src/app/app.config.ts` — verificar ordem de providers
- `frontend/libs/pub/data-access/src/lib/history.facade.ts` — adicionar getProjetoHeader, getAutor (INT-FE-PUB-002/003)
- `frontend/libs/pub/integration/src/lib/pub-shell-integration.service.ts` — cancelamento de poll via empresaChanged (INT-FE-PUB-006)

#### Critérios de aceite

```bash
npx nx lint pub-data-access      # exit 0; PublicacaoHttpAdapter sem import de HttpClientModule direto
npx nx build cordele-web         # exit 0
```

#### Instrução para o implementador

INT-FE-PUB-004: registrar como BLOQUEADA no checklist — não implementar chamada ao endpoint §4.6 até PUB-016 BE ser ratificado. INT-FE-PUB-005: registrar como BLOQUEADA — não fabricar KPIs de ePub; tiles omitidos por design. Ao documentar esses bloqueios, adicionar um comentário `// BLOCKED: INT-FE-PUB-004 — PUB-016 BE pendente` no componente correspondente.

---

### Prioridade P5 — Access Guards

**Status:** pendente
**Issues cobertas:** FE-PUB-021, FE-PUB-022
**Categoria:** FUNCIONAL

#### Objetivo

Criar `libs/pub/access/` e implementar `pubProjetoGuard` (UUID validation + redirect em parâmetro inválido) e `pubStatusGuard` (modo export requer `em_composicao`; modo history sempre permite com empty state).

#### Generators Nx obrigatórios

```bash
npx nx g @nx/angular:library --directory=libs/pub/access \
  --name=pub-access --standalone --buildable \
  --tags="scope:pub,type:util"
```

#### Critérios de aceite

```bash
npx nx test pub-access    # exit 0; guards cobertos por testes parametrizados (UUID válido/inválido, status em_composicao/outros)
npx nx lint pub-access    # exit 0
```

#### Instrução para o implementador

Após criar `libs/pub/access/`, atualizar as rotas em `libs/pub/shell-entry/src/lib/pub.routes.ts` para importar guards de `@cordele/pub-access` em vez do flat lib. Remover stubs da lib flat (`libs/pub/src/lib/access/`).

---

### Prioridade P6 — Navigation / Breadcrumbs

**Status:** pendente
**Issues cobertas:** FE-PUB-023
**Categoria:** WIRING

#### Objetivo

Completar a integração de `PUB_NAV_CONFIG` ao `NavigationService` do shell: registrar o step-bar (stage 4 "Exportar") e os breadcrumbs dinâmicos de T07/T08 via `PubShellIntegrationService.start()`. Ao final, navegar para `/pub/projetos/:id/exportacao-e-validacao` exibe o step-bar com stage 3 (Exportar) ativo e breadcrumb `Projetos › {nomeProjeto} › Exportar`.

#### Problema identificado

- `PUB_NAV_CONFIG` existe em `libs/pub/navigation/src/lib/pub-nav.config.ts` com `stageIndex: 3` e `breadcrumbLabel: 'Publicação'` — estrutura pronta.
- `pub.bootstrap.ts` (`initPub`) registra apenas permissões e feature flags; **não chama** `NavigationService.register(PUB_NAV_CONFIG)`.
- `PubShellIntegrationService.start()` é no-op em P1 com o comentário "Additional module-specific startup logic can be added here in P2" — a chamada de registro nav nunca foi adicionada.
- `PubShellIntegrationService.stop()` tem o stub: `// Breadcrumb flush will be added in P6 (FE-PUB-023) when NavigationService is wired.`
- `PUB_NAV_CONFIG` não diferencia as breadcrumb roots de T07 vs T08 (ambas usam `breadcrumbLabel: 'Publicação'`).

#### Correções mandatórias

1. Adicionar `NavigationService` ao `PubShellIntegrationService` (inject) e chamar `nav.register(PUB_NAV_CONFIG)` em `start()` e `nav.deregister('pub')` em `stop()`.
2. Expandir `PUB_NAV_CONFIG` com `breadcrumbRoutes`: dois templates — um para T07 (`Projetos › {nomeProjeto} › Exportar`) e um para T08 (`Projetos › {nomeProjeto} › Download e Histórico`). Se `NavigationService` não suportar templates dinâmicos ainda, expor um método `PubShellIntegrationService.updateBreadcrumb(nomeProjeto: string)` chamado pelo componente ao carregar o projeto.
3. Substituir o comentário stub em `stop()` pela chamada real de deregistro.

**Decisão arquitetural (planner escolhe uma forma):** usar `updateBreadcrumb(nomeProjeto: string)` em `PubShellIntegrationService`, chamado por `ExportacaoEValidacaoComponent` e `DownloadEHistoricoComponent` via `inject(PubShellIntegrationService).updateBreadcrumb(facade.nomeProjeto())`. Isso mantém RULE-NX-01 (`type:feature` não importa `type:data-access` — o sinal `nomeProjeto` vem da facade já injetada no componente). Não criar novo sinal na integration service — apenas repassar o nome quando o componente já o tem.

#### Arquivos-alvo

- `frontend/libs/pub/integration/src/lib/pub-shell-integration.service.ts` — adicionar `NavigationService`, implementar `nav.register(PUB_NAV_CONFIG)` em `start()`, `nav.deregister('pub')` em `stop()`, e `updateBreadcrumb(nomeProjeto: string)`.
- `frontend/libs/pub/navigation/src/lib/pub-nav.config.ts` — adicionar `breadcrumbRoutes` com templates por rota (T07 + T08), se `NavConfig` suportar.
- `frontend/libs/pub/feature-export/src/lib/exportacao-e-validacao/exportacao-e-validacao.component.ts` — chamar `integrationSvc.updateBreadcrumb(facade.nomeProjeto())` no `ngOnInit` ou efeito reativo.
- `frontend/libs/pub/feature-history/src/lib/download-e-historico/download-e-historico.component.ts` — idem.

#### Contrato de tipo

```typescript
// Adição a PubShellIntegrationService (pub-shell-integration.service.ts)
updateBreadcrumb(nomeProjeto: string): void;
// Chama NavigationService.updateDynamic('pub', { nomeProjeto })
// ou método equivalente que o shell expõe (sem fabricar — apenas se NavigationService suportar;
// se não suportar, logar via Telemetry e não chamar console.log).
```

#### Sequência de execução

1. Verificar API de `NavigationService` do shell para confirmar se `register(config)` e `deregister(key)` existem — se não existirem como métodos nomeados, adaptar para o método que o shell expõe (SPEC-06 §2/§3 é a fonte).
2. Injetar `NavigationService` em `PubShellIntegrationService.start()` e chamar `register`.
3. Adicionar `updateBreadcrumb(nomeProjeto)` no integration service.
4. Em `ExportacaoEValidacaoComponent` e `DownloadEHistoricoComponent`: chamar `updateBreadcrumb` ao resolver o nome do projeto.
5. Atualizar testes unitários de `pub-integration` para cobrir: `start()` chama `nav.register`; `stop()` chama `nav.deregister`; `updateBreadcrumb('Meu Livro')` atualiza a state.

#### Política de testes

- Unit obrigatório: `npx nx test pub-integration` — spy em `NavigationService.register`, verificar chamado no `start()`; spy em `NavigationService.deregister`, verificar chamado no `stop()`.
- E2E não obrigatório em P6 (será coberto por P9 scenario `pub-shell-nav-register`).

#### Multi-empresa

Sem HTTP. NavigationService é injeção de singleton do shell.

#### Critérios de aceite

```bash
npx nx build pub-integration   # exit 0
npx nx lint pub-integration    # exit 0; sem console.log
npx nx test pub-integration    # exit 0; start() registra nav; stop() desregistra; updateBreadcrumb wired
npx nx build cordele-web       # exit 0
```

Verificação funcional: em dev (após `npx nx serve cordele-web`), navegar para `/pub/projetos/00000000-0000-0000-0000-000000000001/exportacao-e-validacao` e confirmar step-bar com "Exportar" ativo (stage 3) e breadcrumb `Projetos › {nomeProjeto} › Exportar`.

#### Riscos

| Risco | Mitigação |
|---|---|
| `NavigationService` do shell não expõe `register`/`deregister` ainda | Verificar API antes de codificar; se stub, implementar no-op e abrir issue de dependência |
| `nomeProjeto` indisponível ao montar o componente (loading) | Usar efeito reativo — `updateBreadcrumb` só é chamado quando `nomeProjeto` não é null/undefined |

#### Instrução para o implementador

Verificar o `NavigationService` em `frontend/libs/shared/` antes de qualquer implementação. Se a API não corresponder ao esperado, adaptar o contrato sem fabricar um serviço paralelo. Não usar `console.log` — se precisar de debug, usar `@cordele/shared/observability`'s `Telemetry.event()`. Após implementar, rodar `npx nx test pub-integration` antes de avançar para P7.

---

### Prioridade P7 — UX Polish

**Status:** pendente
**Issues cobertas:** FE-PUB-024, FE-PUB-025
**Categoria:** FUNCIONAL

#### Objetivo

**FE-PUB-024:** Completar exibição de `traceId` em todos os estados de erro de T07 e T08 (SPEC-07 §4). Os estados de loading/error/empty já existem nos componentes; o gap é que o `X-Correlation-Id` não é exibido na UI quando uma falha ocorre.

**FE-PUB-025:** Completar o fluxo do download gate: (a) toast "O link de download expirou. Gerando um novo link…" antes do re-fetch automático (atualmente só exibido como mensagem de erro na segunda falha); (b) confirmar que a row com `erros_criticos` exibe label "inválido" + botão disabled (já implementado, mas sem teste unitário verificador).

#### Problemas identificados

**FE-PUB-024 — traceId ausente:**

- `ExportFacade.error()` armazena apenas a mensagem de erro traduzida (string pt-BR via `error-mapping.ts`).
- `HistoryFacade.downloadError()` idem — só mensagem.
- Não existe `errorTraceId` signal em nenhuma facade.
- SPEC-07 §4 exige que toda falha exiba o `X-Correlation-Id` para suporte.
- A mensagem de cancelamento no `stop()` diz "empresa alterada" mesmo quando o trigger foi navegação — corrigir para "operação cancelada".

**FE-PUB-025 — toast ausente no primeiro re-fetch:**

- `ArtifactDownloadService._refetchAndOpen()` re-fetcha silenciosamente (sem toast).
- O toast "O link expirou. Gerando um novo link…" só aparece como mensagem de erro quando a segunda tentativa também falha (throwError com message).
- SPEC-07 §2 exige o toast na primeira falha (antes do re-fetch), não apenas como resultado da segunda falha.
- `PublicationHistoryRowComponent` já exibe label "inválido" e botão disabled para rows `erros_criticos` (linha 234 do componente) — este ponto está correto, mas falta teste unitário explícito.

#### Correções mandatórias

**FE-PUB-024:**

1. Adicionar `errorTraceId = signal<string | null>(null)` em `ExportFacade` e `HistoryFacade`.
2. Ao receber erro HTTP, extrair `X-Correlation-Id` do header da resposta (via `HttpErrorResponse.headers.get('x-correlation-id')` ou campo equivalente no `AppError` normalizado pelo interceptor de `access-http-base`) e armazenar em `errorTraceId`.
3. Em `ExportacaoEValidacaoComponent`, no bloco `@if (facade.phase() === 'error')`: adicionar `@if (facade.errorTraceId()) { <span class="text-xs text-secondary font-mono">Trace: {{ facade.errorTraceId() }}</span> }`.
4. Em `DownloadEHistoricoComponent`, nos blocos `status === 'error'` e `downloadError()`: exibir `traceId` da mesma forma.
5. Corrigir mensagem de cancelamento em `ExportFacade` (quando `empresaChanged` dispara via `stop()`): substituir "empresa alterada" por "operação cancelada ao sair da tela".

**FE-PUB-025:**

1. Em `HistoryFacade.download()`: antes de chamar `ArtifactDownloadService.download()`, subscrever o observable via `tap()` para distinguir as fases:
   - No início do download, emitir um evento de "buscando URL" (sem toast ainda).
   - Ao detectar o re-fetch (401/404 na primeira tentativa), emitir toast via `@cordele/shared/ui-feedback` `ToastService.show('O link de download expirou. Gerando um novo link…')` antes de a segunda tentativa ser feita.
2. Alternativa se `ArtifactDownloadService` não expõe observable intermediário: refatorar `_refetchAndOpen()` para emitir dois valores — um `{status: 'refetching'}` antes do re-fetch e um `{status: 'success'}` após. A facade escuta o `{status: 'refetching'}` para acionar o toast.
3. Decisão: usar a alternativa 2 — adicionar `status: 'refetching' | 'success'` ao `DownloadResult`, emitido por `_refetchAndOpen()` antes do `switchMap`. A `HistoryFacade` interpreta `status === 'refetching'` e chama `toastService.show(...)`.
4. Adicionar teste unitário explícito para o gate: `DownloadEHistoricoComponent` com row `{epubcheckStatus: 'erros_criticos'}` → botão disabled + texto "inválido".

#### Arquivos-alvo

**FE-PUB-024:**

- `frontend/libs/pub/data-access/src/lib/export.facade.ts` — adicionar `errorTraceId = signal<string | null>(null)`; popular ao receber erro HTTP.
- `frontend/libs/pub/data-access/src/lib/history.facade.ts` — idem para `downloadError` + `errorTraceId`.
- `frontend/libs/pub/feature-export/src/lib/exportacao-e-validacao/exportacao-e-validacao.component.ts` — exibir `facade.errorTraceId()` no bloco `phase === 'error'`.
- `frontend/libs/pub/feature-history/src/lib/download-e-historico/download-e-historico.component.ts` — exibir `traceId` nos blocos de erro.

**FE-PUB-025:**

- `frontend/libs/pub/data-access/src/lib/artifact-download.service.ts` — refatorar `DownloadResult` com `status: 'refetching' | 'success'`; emitir `{status: 'refetching'}` em `_refetchAndOpen()` antes da segunda tentativa.
- `frontend/libs/pub/data-access/src/lib/history.facade.ts` — interpretar `status === 'refetching'` e chamar `toastService.show('O link de download expirou. Gerando um novo link…')`.
- `frontend/libs/pub/feature-history/src/lib/download-e-historico/download-e-historico.component.spec.ts` — adicionar caso de teste: row `erros_criticos` → botão disabled + span "inválido".

#### Contrato de tipo

```typescript
// Adição a DownloadResult (artifact-download.service.ts)
export interface DownloadResult {
  status: 'success' | 'refetching';
  arquivoUrl?: string;
  error?: string;
}

// Adição às facades (export.facade.ts + history.facade.ts)
readonly errorTraceId: Signal<string | null>;
// Populado de: AppError.traceId | HttpErrorResponse.headers.get('x-correlation-id')
```

#### Sequência de execução

1. `ExportFacade` e `HistoryFacade`: adicionar `errorTraceId` signal; extrair traceId do `AppError` normalizado.
2. `ArtifactDownloadService`: refatorar `_refetchAndOpen()` para emitir `{status: 'refetching'}` antes do `switchMap` — usar `startWith({status: 'refetching' as const})` + `switchMap`.
3. `HistoryFacade.download()`: pipe no observable de `ArtifactDownloadService.download()`, reagir ao `status === 'refetching'` com `toastService.show(...)`.
4. Componentes: adicionar `@if (facade.errorTraceId()) { ... }` nos blocos de erro.
5. Testes: cobrir traceId exibido; toast disparado no re-fetch; gate disabled/inválido.

#### Política de testes

```bash
npx nx test pub-data-access      # exit 0; ExportFacade.errorTraceId populado em erro; DownloadResult.status=refetching emitido antes do success
npx nx test pub-feature-export   # exit 0; bloco phase=error exibe traceId
npx nx test pub-feature-history  # exit 0; status=error exibe traceId; row erros_criticos → disabled + inválido
```

#### Multi-empresa

Sem impacto direto. O `traceId` vem do interceptor de `@cordele/shared/access-http-base` (já configurado).

#### Critérios de aceite

```bash
npx nx lint pub-data-access      # exit 0; sem console.log
npx nx test pub-data-access      # exit 0
npx nx lint pub-feature-export   # exit 0
npx nx test pub-feature-export   # exit 0; traceId presente no bloco error
npx nx lint pub-feature-history  # exit 0
npx nx test pub-feature-history  # exit 0; toast disparado; gate disabled verificado por teste
npx nx build cordele-web         # exit 0
```

#### Riscos

| Risco | Mitigação |
|---|---|
| `AppError` normalizado pelo `access-http-base` não carrega `traceId` | Verificar contrato de `ErrorNormalize` em `access-http-base`; se ausente, extrair direto de `HttpErrorResponse.headers` |
| `ToastService` não existe em `@cordele/shared/ui-feedback` | Verificar API do shared; se ausente, usar um signal `toastMessage = signal<string|null>(null)` temporário e exibir como inline notice (sem `console.log`) |
| Refatoração de `DownloadResult` quebra chamadores existentes | `status` é adição de campo; chamadores que não leem `status` continuam funcionando |

#### Instrução para o implementador

Inspecionar `frontend/libs/shared/ui-feedback/` antes de usar `ToastService` — confirmar API pública. Se a lib não expõe toast, usar a estratégia de signal inline no componente. Verificar `frontend/libs/shared/access-http-base/` para confirmar como o `X-Correlation-Id` é normalizado no `AppError` — não duplicar lógica de extração de header. A correção da mensagem de cancelamento (`empresaChanged` via `stop()`) é obrigatória para P7 — apenas substituir a string, sem refatorar a lógica.

---

### Prioridade P8 — Observability

**Status:** pendente
**Issues cobertas:** FE-PUB-026
**Categoria:** FUNCIONAL

#### Objetivo

Implementar `publishBreadcrumb(event, projetoId, correlationId)` em `PubShellIntegrationService` e wirá-lo para os 3 lifecycle events: `export-requested` (disparo do POST), `verdict-shown` (fase terminal renderizada), `downloaded` (signed URL aberta). Cada evento usa `@cordele/shared/observability`'s `Telemetry` interface. Nenhum `console.log` — regra `no-console-log` é blocking gate.

#### Problema identificado

- `PubShellIntegrationService` não tem `publishBreadcrumb`.
- `@cordele/shared/observability` existe como stub: `interface Telemetry { event(name: string): void; }` — sem implementação de serviço injetável.
- Os 3 pontos de emissão (ExportFacade, ExportacaoEValidacaoComponent, ArtifactDownloadService/HistoryFacade) não chamam nenhum método de telemetria.

#### Correções mandatórias

1. Criar `ObservabilityService` em `@cordele/shared/observability` (se não existir) como wrapper injetável de `Telemetry`: `@Injectable({ providedIn: 'root' }) export class ObservabilityService { event(name: string, data?: Record<string, string>): void { /* no-op stub; real impl fica em P-future */ } }`. Sem `console.log` — silencioso por design em stub.
2. Adicionar `publishBreadcrumb(event: string, projetoId: string, correlationId?: string): void` em `PubShellIntegrationService`: delegar para `ObservabilityService.event(event, { projetoId, correlationId: correlationId ?? '' })`.
3. Wiring `export-requested`: `ExportFacade.requestExport()` — após chamar o adapter POST, chamar `integrationSvc.publishBreadcrumb('export-requested', projetoId, traceId)`.
4. Wiring `verdict-shown`: `ExportacaoEValidacaoComponent` — em efeito reativo que detecta transição para fase terminal (`valido | avisos | erros`), chamar `integrationSvc.publishBreadcrumb('verdict-shown', projetoId, facade.errorTraceId() ?? undefined)`.
5. Wiring `downloaded`: `HistoryFacade.download()` — ao receber `{status: 'success'}` de `ArtifactDownloadService.download()`, chamar `integrationSvc.publishBreadcrumb('downloaded', projetoId)`.

**Decisão de boundary:** `ExportFacade` (type:data-access) não pode importar `PubShellIntegrationService` (type:feature) — violaria RULE-NX-03. Usar token de DI:

```typescript
// libs/pub/integration/src/lib/pub-breadcrumb.token.ts
export const PUB_BREADCRUMB = new InjectionToken<(event: string, projetoId: string, correlationId?: string) => void>('PUB_BREADCRUMB');
// app.config.ts: { provide: PUB_BREADCRUMB, useFactory: () => { const svc = inject(PubShellIntegrationService); return svc.publishBreadcrumb.bind(svc); } }
// ExportFacade: private readonly breadcrumb = inject(PUB_BREADCRUMB, { optional: true });
```

#### Arquivos-alvo

- `frontend/libs/shared/observability/src/lib/observability.ts` — adicionar `ObservabilityService` injetável (sem console.log).
- `frontend/libs/pub/integration/src/lib/pub-shell-integration.service.ts` — adicionar `publishBreadcrumb(event, projetoId, correlationId?)`.
- `frontend/libs/pub/integration/src/lib/pub-breadcrumb.token.ts` — novo `InjectionToken<PubBreadcrumbFn>`.
- `frontend/apps/cordele-web/src/app/app.config.ts` — registrar `PUB_BREADCRUMB` token.
- `frontend/libs/pub/data-access/src/lib/export.facade.ts` — `inject(PUB_BREADCRUMB, { optional: true })` + chamar em `requestExport()`.
- `frontend/libs/pub/feature-export/src/lib/exportacao-e-validacao/exportacao-e-validacao.component.ts` — efeito de fase terminal → `publishBreadcrumb('verdict-shown', ...)`.
- `frontend/libs/pub/data-access/src/lib/history.facade.ts` — chamar `publishBreadcrumb('downloaded', ...)` ao receber `{status: 'success'}`.
- `frontend/libs/pub/integration/src/index.ts` — exportar `PUB_BREADCRUMB`.

#### Contrato de tipo

```typescript
// observability.ts — adição
@Injectable({ providedIn: 'root' })
export class ObservabilityService implements Telemetry {
  event(name: string, data?: Record<string, string>): void { /* stub no-op */ }
}

// pub-breadcrumb.token.ts
export type PubBreadcrumbFn = (event: string, projetoId: string, correlationId?: string) => void;
export const PUB_BREADCRUMB = new InjectionToken<PubBreadcrumbFn>('PUB_BREADCRUMB');

// PubShellIntegrationService — adição
publishBreadcrumb(event: string, projetoId: string, correlationId?: string): void;
```

#### Política de testes

```bash
npx nx test pub-integration   # exit 0;
  # spy em ObservabilityService.event verifica:
  #   publishBreadcrumb('export-requested', 'proj-123') → event('export-requested', {projetoId:'proj-123'})
  #   publishBreadcrumb('verdict-shown', 'proj-123')    → event('verdict-shown', ...)
  #   publishBreadcrumb('downloaded', 'proj-123')       → event('downloaded', ...)
```

#### Multi-empresa

Sem impacto. `projetoId` é extraído do contexto da rota/facade, não do contexto de empresa.

#### Critérios de aceite

```bash
npx nx lint pub-integration    # exit 0; sem console.log (arch-conformance gate bloqueia)
npx nx test pub-integration    # exit 0; 3 events verificados por spy
npx nx lint shared-observability   # exit 0
npx nx build cordele-web       # exit 0
```

#### Riscos

| Risco | Mitigação |
|---|---|
| `ObservabilityService` interfere com módulo existente | É adição aditiva; stub é no-op; sem side-effect |
| Boundary violation: ExportFacade tentando importar PubShellIntegrationService | Usar token `PUB_BREADCRUMB` conforme decisão acima; o implementador NÃO importa o service direto |
| arch-conformance bloqueia `console.log` no stub | O stub usa no-op sem `console.log` — compliant desde a criação |

#### Instrução para o implementador

Verificar se `ObservabilityService` já existe em `frontend/libs/shared/observability/src/lib/observability.ts` como classe (atualmente é apenas `interface Telemetry`). Adicionar a classe sem remover a interface. Não usar `console.log` nem `console.debug` em nenhum ponto — o `arch-conformance.py` bloqueia isso. A ordem de implementação é: (1) `ObservabilityService`, (2) token `PUB_BREADCRUMB`, (3) `publishBreadcrumb` no service, (4) wiring nas facades/componentes. Testar com `npx nx lint pub-integration` antes de avançar.

---

### Prioridade P9 — E2E + Hardening

**Status:** pendente
**Issues cobertas:** FE-PUB-027, FE-PUB-028
**Categoria:** VALIDACAO

#### Objetivo

Implementar os 26 cenários Playwright nos spec files já scaffoldados em `apps/pub-e2e/src/`:
- 19 cenários T07 em `exportacao-e-validacao.spec.ts` (FE-PUB-027)
- 7 cenários T08 em `download-e-historico.spec.ts` (FE-PUB-028)

**Requisito de primeira classe — smoke test contra backend real:** adicionar `apps/pub-e2e/src/smoke.spec.ts` com ao menos 1 teste que faz chamada HTTP real ao `pub-service` em `http://localhost:3002/api/v1/pub`. Este teste fecha o buraco de cobertura identificado na sessão: adaptadores com path errado (ex.: `/api/pub` → 404) atravessam lint, build, test unitário e arch-conformance sem serem detectados. O smoke test falharia com esse path porque `/api/pub` retorna 404, enquanto `/api/v1/pub` retorna 401 (autorização, não rota inexistente).

#### Problema identificado

- Ambos os spec files têm todos os cenários em `test.skip()` — nenhum implementado.
- O pitfall `fe-nx-register-module:e2e-stub:empty-describe-passes-as-green` está ativo: os stubs passam em `npx nx e2e pub-e2e` por causa do `test.skip()`, mas isso é um falso positivo.
- Nenhum gate atual verifica URLs reais contra o backend: lint/test/arch-conformance validam estrutura, não comportamento HTTP real.
- Os stubs usam `page.goto('/pub')` como placeholder — selectors incorretos para todos os cenários.

#### Correções mandatórias

**smoke.spec.ts (requisito absoluto — implementar primeiro):**

Criar `frontend/apps/pub-e2e/src/smoke.spec.ts`:

```typescript
// smoke.spec.ts — smoke test contra backend real (pub-service)
// Fecha o gap: adaptador com /api/pub (errado) retorna 404; /api/v1/pub (correto) retorna 401.
// Se pub-service não estiver no ar, o teste faz test.skip() com aviso — nunca falso positivo.
import { test, expect, request as playwrightRequest } from '@playwright/test';

const PUB_SERVICE_BASE = process.env['PUB_SERVICE_URL'] ?? 'http://localhost:3002';

test.describe('pub-service smoke', () => {
  test('GET /api/v1/pub/publicacoes retorna 401 (não 404) — path correto no ar', async () => {
    const ctx = await playwrightRequest.newContext();
    let response;
    try {
      response = await ctx.get(`${PUB_SERVICE_BASE}/api/v1/pub/publicacoes`, {
        headers: { 'Accept': 'application/json' },
        timeout: 5000,
      });
    } catch {
      test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
      return;
    }
    // 401 = auth required → path existe. 404 = path errado.
    expect(response.status(), `Esperado 401 mas recebeu ${response.status()} — verifique ACCESS_HTTP_BASE`).toBe(401);
    await ctx.dispose();
  });
});
```

**Abordagem para os 26 cenários (Playwright route intercept):**

Os 26 cenários de T07+T08 usam mocks via `page.route()` (não dependem do backend real — apenas o smoke.spec.ts usa o backend). Isso é correto: os cenários testam o comportamento do componente FE dado respostas determinísticas do servidor.

Estrutura de implementação:

```
apps/pub-e2e/src/
  smoke.spec.ts                        -- smoke contra backend real
  exportacao-e-validacao.spec.ts       -- 19 cenários T07 com route intercept
  download-e-historico.spec.ts         -- 7 cenários T08 com route intercept
  support/
    api-mocks.ts                       -- helpers de route intercept reutilizáveis
    selectors.ts                       -- seletores de UI por componente
```

**Mocks obrigatórios para os cenários:**

| Mock | Handler | Cenários |
|---|---|---|
| POST `/api/v1/pub/publicacoes` → 202 + `{publicacaoId, status:'gerando'}` | `api-mocks.triggerExport(page, opts)` | C1, C2, C3, C4, C5, C6, C7, C8 |
| GET `/api/v1/pub/publicacoes/:id/status` → `{status:'gerando'}` então `{status:'publicado', ...}` | `api-mocks.pollStatus(page, sequence)` | C1, C3, C4, C5, C6 |
| POST → 200 (idempotente) | `api-mocks.triggerInFlight(page)` | C2 |
| POST → 409 `pub:manuscript-missing` | `api-mocks.triggerError(page, 409, 'pub:manuscript-missing')` | C9 |
| POST → 422 `pub:metadata-incomplete` | `api-mocks.triggerError(page, 422, 'pub:metadata-incomplete')` | C10 |
| POST → 502 com `X-Correlation-Id` | `api-mocks.triggerError(page, 502, 'pub:status-advance-failed')` | C11 |
| GET status → 200 com `epubcheckStatus:'erros_criticos'` | `api-mocks.pollStatus(page, [{status:'publicado',epubcheckStatus:'erros_criticos'}])` | C12 |
| GET status → network error | `api-mocks.networkError(page, '/api/v1/pub/publicacoes/*/status')` | C13 |
| GET → 404 | `api-mocks.notFound(page)` | C14 |
| GET → 403 | `api-mocks.forbidden(page)` | C15 |
| GET `/api/v1/pub/publicacoes` → lista com variedade | `api-mocks.historyList(page, items)` | T08 C1..C7 |
| GET `/api/v1/pub/publicacoes/stats` | `api-mocks.stats(page, statsPayload)` | T08 C2, C3 |
| GET `/api/v1/pub/publicacoes/:id/download-url` → signed URL | `api-mocks.signedUrl(page, url)` | T08 C4 |
| GET signed URL → 401 (expirado) | `api-mocks.signedUrlExpired(page)` | T08 C6 |

**Cenários prioritários a implementar primeiro** (maior risco de regressão):
1. C1 — trigger + poll até terminal (pub-export-trigger, pub-poll-status, pub-poll-terminal)
2. C4 — veredito válido renderizado (pub-verdict-rendered)
3. C13 — network error → banner retryável, sem phantom gerando (pub-err-network-retry)
4. C16 — toda falha exibe traceId (pub-err-trace-id)
5. T08 C4 — download via signed URL (pub-download-signed-url)
6. T08 C5 — gate bloqueia erros_criticos (pub-gate-download)

#### Arquivos-alvo

- `frontend/apps/pub-e2e/src/smoke.spec.ts` — **criar** (smoke test backend real)
- `frontend/apps/pub-e2e/src/support/api-mocks.ts` — **criar** (helpers de route intercept)
- `frontend/apps/pub-e2e/src/support/selectors.ts` — **criar** (seletores de UI estáveis)
- `frontend/apps/pub-e2e/src/exportacao-e-validacao.spec.ts` — **substituir** todos os `test.skip()` por implementações reais (19 cenários)
- `frontend/apps/pub-e2e/src/download-e-historico.spec.ts` — **substituir** todos os `test.skip()` por implementações reais (7 cenários)

#### Seletores de UI obrigatórios (estáveis, baseados em `data-testid` ou ARIA)

Antes de implementar, mapear os `data-testid` presentes nos componentes:

| Elemento | Seletor |
|---|---|
| Botão "Gerar ePub" | `[data-testid="btn-exportar"]` ou `button:has-text("Gerar ePub")` |
| Spinner de progresso | `[role="progressbar"]` |
| Banner de veredito válido | `[data-testid="banner-valido"]` ou elemento com texto "ePub válido" |
| Banner de erros críticos | `[data-testid="banner-erros"]` ou texto "Erros críticos" |
| traceId na UI | `[data-testid="error-trace-id"]` ou `span.font-mono:has-text("Trace:")` |
| Botão "Baixar ePub" | `[data-testid="btn-baixar"]` ou `button:has-text("Baixar ePub")` |
| Label "inválido" em row | `span:has-text("inválido")` |
| Botão disabled em row erros_criticos | `button[disabled]:near(span:has-text("inválido"))` |

Se `data-testid` não existir nos componentes atuais, o implementador os adiciona como parte de P9 — não é regressão, é hardening.

#### Política de testes

```bash
npx nx e2e pub-e2e --testFile=smoke.spec.ts   # exit 0 se pub-service no ar; skip se indisponível
npx nx e2e pub-e2e                             # exit 0; 26 cenários T07+T08 passando
```

**Pitfall ativo:** se `test.skip()` ainda estiver em algum cenário ao executar `nx e2e`, o cenário não conta como PASS. O DoD exige 0 cenários com `test.skip()` (exceto o skip condicional do smoke quando o backend está fora do ar).

#### Multi-empresa

Cenários de shell lifecycle (C19 — `pub-empresa-cancel`, `pub-shell-unmount`) simulam troca de empresa via mock do `EmpresaContextService` — sem HTTP real no cenário.

#### Critérios de aceite

```bash
# Com pub-service no ar (docker compose up pub-service):
npx nx e2e pub-e2e --testFile=smoke.spec.ts      # exit 0; status 401 confirmado
# Todos os cenários:
npx nx e2e pub-e2e                                # exit 0; 26 + 1 smoke = 27 testes passando
# Sem pub-service no ar:
npx nx e2e pub-e2e --testFile=smoke.spec.ts      # exit 0; smoke marcado test.skip (não falha)
npx nx e2e pub-e2e                                # exit 0; 26 cenários (route-intercept) + 1 smoke skip
```

#### Riscos

| Risco | Mitigação |
|---|---|
| `data-testid` ausente nos componentes → seletor frágil | Adicionar `data-testid` como parte do P9 — não é regressão |
| Cenário de Retry-After difícil de simular com route intercept | Usar `page.route` com delay + `Retry-After` header mock; validar que o próximo GET ocorre após o delay aproximado |
| pub-service fora do ar no CI → smoke falha | Smoke usa `try/catch` + `test.skip()` condicional — nunca falha o pipeline por ausência de infra |
| 26 cenários complexos em uma única prioridade | Implementar na ordem de risco: C1, C4, C13, C16, T08-C4, T08-C5 primeiro; demais na sequência |

#### Instrução para o implementador

Implementar `smoke.spec.ts` **primeiro** e confirmar que retorna 401 contra `http://localhost:3002/api/v1/pub/publicacoes` com `pub-service` no ar. Isso é o gate de sanidade de URL antes de qualquer outro trabalho de E2E. Só então implementar `api-mocks.ts`, `selectors.ts` e os 26 cenários. Não aceitar `npx nx e2e pub-e2e` como PASS enquanto houver `test.skip()` em cenários não-smoke. Se `data-testid` precisar ser adicionado nos componentes, adicionar no mesmo PR de P9 — é parte do hardening, não da feature. Verificar o `playwright.config.ts` — o `baseURL` aponta para `http://localhost:4200`; o smoke usa `http://localhost:3002` diretamente via `request.newContext()` (não o `page`, que usa o baseURL do app).

---

## 4. Dependências externas

| Dependência | Tipo | Bloqueante para | Estado |
|---|---|---|---|
| PUB-016 BE — endpoint §4.6 lista detalhada de avisos `{code,msg,local}` | Backend | INT-FE-PUB-004, FE-PUB-016 | BLOQUEADA — aguarda ratificação BE |
| Decisão de produto — campo-fonte para KPIs ePub (Tamanho/Páginas/Capítulos/Imagens) | Produto | INT-FE-PUB-005, FE-PUB-015 | BLOQUEADA — aguarda PM/Tech Lead |
| `@cordele/shared/access-http-base` — interceptors, ErrorNormalize, traceId | FE shared | INT-FE-PUB-001 (P4) | Disponível — verificar wiring em app.config.ts |
| `@cordele/shared/empresa-context` — `EmpresaContext.activeEmpresa$` | FE shared | INT-FE-PUB-006, FE-PUB-006 | Disponível — PubShellIntegrationService assina |
| `@cordele/proj` — `getProjetoHeader` cross-context | Cross-module | INT-FE-PUB-002 | Disponível — verificar contrato |
| `@cordele/comp` — `getAutor` cross-context | Cross-module | INT-FE-PUB-003 | Disponível — verificar contrato |

---

## 5. Restrições arquiteturais (Nx boundaries, tax-map — RULE-NX-01..07)

| Regra | Aplicação em PUB |
|---|---|
| RULE-NX-01 — `scope:pub` não importa `scope:imp` nem `scope:comp` diretamente | Cross-context via `@cordele/shared` ou via `@cordele/proj` e `@cordele/comp` barrel público |
| RULE-NX-02 — `type:feature` não exporta componentes para `type:data-access` | `pub-feature-export` não re-exporta componentes para `pub-data-access` |
| RULE-NX-03 — `type:data-access` não importa `type:feature` | `pub-data-access` não importa de `pub-feature-export` |
| RULE-NX-04 — `type:shell-entry` pode importar `type:data-access`, `type:util`, `type:feature` | `pub-shell-entry` importa `pub-navigation` e `pub-integration` |
| RULE-NX-05 — HTTP apenas em `type:data-access` | `PubShellIntegrationService` (integration) não tem HttpClient |
| Tax-map tags obrigatórios | shell-entry, navigation: `type:util`, integration: `type:feature`, data-access: `type:data-access`, feature-export/history: `type:feature`, ui: `type:ui`, access: `type:util` |

---

## 6. Referências

| Documento | Relevância |
|---|---|
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` | Tabela de rotas + guards |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` | PublicacaoStatus, ExportPhase, podeBaixar |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` | Contratos de serviços e adapters |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-05-tool-contract.md` | MODULE_KEY, PERMISSION_MAP, FEATURE_FLAGS, DESCRIPTOR |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` | PubShellIntegrationService, bootstrap |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` | AppError URN → msg pt-BR |
| `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` | 26 cenários T07+T08 |
| `docs/architecture/frontend/modules/pub/frontend/issues/issues_map.md` | Mapa de issues por layer e caminho crítico |
| `docs/architecture/frontend/standards/nx-boundaries.md` | Tags, boundaries, tax-map |
| `docs/architecture/frontend/standards/access-layer-contracts.md` | AuthSession, EmpresaContext, AccessDecision |
| `docs/architecture/shared/multi-empresa.md` | EmpresaContextHolder, empresa switch propagation |
| ADR-PUB-001 | Poll sem SSE, bounded poll, Retry-After |
