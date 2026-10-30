# Plano FE — PUB (Publicação) — cordele-web

> Gerado por: /fe-planner · 2026-08-31
> Tipo: REPLANEJAMENTO COMPLETO (plano canônico inexistente; backlog em módulo, não no caminho de execução)
> Módulo: PUB · Microservice: pub-service · Nx libs target: libs/pub/{shell-entry,navigation,integration,data-access,feature-export,ui,feature-history,access}

## Status das prioridades

- P1 — Foundation — **pendente** (bloqueou o fe-implement por ausência deste plano)
- P2 — Data Access — pendente
- P3 — Feature Libs — pendente
- P4 — Hub Integrations — pendente
- P5 — Access Guards — pendente
- P6 — Navigation / Breadcrumbs — pendente
- P7 — UX Polish — pendente
- P8 — Observability — pendente
- P9 — E2E + Hardening — pendente

---

## 0. Leitura executiva do estado atual

### Papel do módulo FE

PUB é o passo final do pipeline editorial do Cordelê: dado um projeto em `em_composicao`, o usuário dispara a geração do ePub via `pub-service`, acompanha o build via poll limitado (POST 202 + GET status com Retry-After, sem SSE e sem setInterval — ADR-PUB-001), recebe o veredito epubcheck server-authoritative (`valido`/`avisos` → download habilitado; `erros_criticos` → bloqueado) e consulta o histórico de publicações. PUB não é um landing module: toda entrada chega com `projetoId` originado de COMP (T06 "Exportar") ou PROJ.

### Estado atual observado

Score ES: **15/100** (Inicial). Última validação: `2026-08-31T21:30:59Z`. Último impl: BLOQUEADO (`2026-08-31T21:35:45Z`) por ausência do plano canônico em `docs/architecture/frontend/plans/plan-FE-PUB.md`. Existe um plano em `docs/architecture/frontend/modules/pub/frontend/plans/plan-FE-PUB.md` (90 linhas, gerado pelo fe-architect-backlog), mas sem as seções estruturais §0–§5 que o fe-implement exige.

O `/fe-architect-promote` (D-494) entregou `frontend/libs/pub/` como biblioteca Nx **plana** (project name: `pub`) com:
- `pub.routes.ts` — PUB_ROUTES registradas em app.routes.ts ✓
- `export.facade.ts` + `history.facade.ts` — signals, bounded poll sem setInterval ✓
- `models/pub.models.ts` — tipos alinhados ao api-contract ✓
- `api/publicacao.port.ts` + `publicacao-http.adapter.ts` + `publicacao-mock.adapter.ts` ✓
- `access/pub-projeto.guard.ts` + `pub-status.guard.ts` (stubs) ✓
- `feature-exportacao/exportacao-e-validacao.component.ts` + `feature-historico/download-e-historico.component.ts` (componentes smart promovidos do protótipo) ✓
- `pub.providers.ts` (factory mock/http) ✓
- PUB registrado em `app.routes.ts` e `sidebar.component.ts` ✓

O que **não existe**: as 8 sub-libs arquiteturais (`libs/pub/shell-entry`, `libs/pub/navigation`, `libs/pub/integration`, `libs/pub/data-access`, `libs/pub/feature-export`, `libs/pub/ui`, `libs/pub/feature-history`, `libs/pub/access`) e o app `pub-e2e`. O promote é um scaffold flat; as sub-libs são o destino final.

### Continuidade da última rodada

Nenhuma: é a primeira execução do planner para PUB. O implementador tentou P1 e bloqueou por ausência deste plano. 34 issues de arquitetura existem (32 ABERTA, 2 BLOQUEADA — INT-FE-PUB-004 e INT-FE-PUB-005).

### Diagnóstico executivo

Tipo de planejamento: **REPLANEJAMENTO COMPLETO**. O módulo está no zero de execução (score 15 vem só do scaffold do promote). O plano anterior (no diretório do módulo) tinha o mapa de waves mas sem DoD executável. Este plano resolve a ambiguidade central ("pub-shell-entry" é a sub-lib ainda não criada) e define a estratégia de migração do flat lib para as sub-libs.

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

### Gaps

1. **Ausência das 8 sub-libs Nx**: `libs/pub/shell-entry`, `libs/pub/navigation`, `libs/pub/integration`, `libs/pub/data-access`, `libs/pub/feature-export`, `libs/pub/ui`, `libs/pub/feature-history`, `libs/pub/access` — nenhuma existe.
2. **`pub.contract.ts` ausente**: MODULE_KEY, PUB_MENU_METADATA, PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS não existem — FE-PUB-001 pendente.
3. **`pub.descriptor.ts` e `pub.bootstrap.ts` ausentes**: PUB_MODULE_DESCRIPTOR não registrado — FE-PUB-003/004 pendentes.
4. **PUB_NAV_CONFIG ausente**: step-bar stage 4 "Exportar" não configurado — FE-PUB-005 pendente.
5. **PubShellIntegrationService ausente**: empresa subscription e lifecycle breadcrumbs não implementados — FE-PUB-006 pendente.
6. **`pub.routes.ts` no flat lib, não em shell-entry**: a versão atual (`libs/pub/src/lib/pub.routes.ts`) tem guards funcionais mas não inclui `authGuard`, `empresaGuard` nem `accessGuard` — migração para shell-entry com guards completos pendente.
7. **Pitfall conhecido (fe-issue-generator:checklist-emoji-markers)**: checklist das 34 issues usa marcadores emoji (🔲/✅) em vez de `- [ ]` / `- [x]`. O `plan-state-extractor.py` não parseia corretamente — ao rodar a Etapa 0 do planner, esperar exit 2 por issue e prosseguir com leitura direta das issues.
8. **Pitfall conhecido (fe-architect-promote:app-theme)**: o promote pode ter deixado tokens CSS do protótipo sem correspondente em `apps/cordele-web/src/theme.css`. Verificar em P3 antes de promover T07/T08 que os tokens usados pelos componentes existem no tema do app.
9. **INT-FE-PUB-004 BLOQUEADA**: lista detalhada de avisos (§4.6) sem endpoint ratificado — PUB-016 BE pendente. `WarningsDetailsComponent` entrega contagens apenas (MVP).
10. **INT-FE-PUB-005 BLOQUEADA**: KPIs ePub (Tamanho/Páginas/Capítulos/Imagens) sem campo-fonte no api-contract §6 — decisão de produto pendente. Tiles simplesmente omitidos.

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
| P6 | Navigation / Breadcrumbs | PUB_NAV_CONFIG integrado ao NavigationService | FE-PUB-023 |
| P7 | UX Polish | Loading/error/empty states e download gate | FE-PUB-024..025 |
| P8 | Observability | Telemetria 3 lifecycle events | FE-PUB-026 |
| P9 | E2E + Hardening | 26 cenários Playwright T07+T08 | FE-PUB-027..028 |

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

Verificar que `PUB_NAV_CONFIG` (criado em P1 em `libs/pub/navigation/`) está integrado ao `NavigationService` do shell corretamente. Confirmar que o step-bar mostra stage 4 "Exportar" nas rotas PUB e que o breadcrumb exibe "Publicação" com path correto.

#### Critérios de aceite

```bash
npx nx build cordele-web   # exit 0
```

Verificação manual: navegar para `/pub/projetos/:id/exportacao-e-validacao` e confirmar step-bar com stage 4 ativo e breadcrumb `Publicação > Exportação e Validação`.

---

### Prioridade P7 — UX Polish

**Status:** pendente
**Issues cobertas:** FE-PUB-024, FE-PUB-025
**Categoria:** FUNCIONAL

#### Objetivo

Unificar loading states, error banners e empty states em T07 + T08 (FE-PUB-024). Implementar download gate completo: label "inválido" quando `!podeBaixar`, auto re-fetch de signed-URL expirada antes do redirect, ciclo de vida do signed-URL (FE-PUB-025).

#### Critérios de aceite

```bash
npx nx test pub-feature-export   # exit 0; loading/error/empty states verificados
npx nx test pub-feature-history  # exit 0; estados verificados
```

---

### Prioridade P8 — Observability

**Status:** pendente
**Issues cobertas:** FE-PUB-026
**Categoria:** FUNCIONAL

#### Objetivo

Publicar 3 lifecycle events com `correlationId` (do interceptor `@cordele/shared/access-http-base`): `export-requested` (ao disparar), `verdict-shown` (ao exibir resultado epubcheck), `downloaded` (ao abrir signed-URL).

#### Critérios de aceite

```bash
npx nx test pub-integration   # exit 0; spy verifica que os 3 eventos são publicados com correlationId
```

---

### Prioridade P9 — E2E + Hardening

**Status:** pendente
**Issues cobertas:** FE-PUB-027, FE-PUB-028
**Categoria:** VALIDACAO

#### Objetivo

Criar app `pub-e2e` com Playwright e implementar os 26 cenários de SPEC-08: 19 em T07 (`exportacao-e-validacao.feature`) e 7 em T08 (`download-e-historico.feature`).

Pitfall `fe-nx-register-module:e2e-stub:empty-describe-passes-as-green`: se o gerador criar specs vazias (0 cenários), não aceitar como PASS. Usar `test.fail()` como placeholder até os cenários serem implementados.

#### Critérios de aceite

```bash
npx nx e2e pub-e2e   # exit 0; 26 cenários T07+T08 passando
```

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
