# Plano FE — PROJ (cordele-web)

## Status das prioridades

- P1 — pendente (unit tests + guards — MVP blocker)
- P2 — pendente (ProjetoApiService + DTOs — real backend integration)
- P3 — pendente (E2E tests — apps/proj-e2e)
- P4 — pendente (Feature Libs + UI components)
- P5 — pendente (Shell Integration + Navigation + Observability)
- P6 — pendente (LGPD + INT cross-module)
- P7 — pendente (Refactor monolitico → 8 sublibaries — DIFERIDO)

---

## 0. Leitura executiva do estado atual

### Papel do módulo FE

O módulo PROJ é a tela raiz da experiência do usuário em Cordelê: lista de projetos (T02 — Biblioteca de Projetos) e histórico de publicações + reopen (T08 — Download e Histórico). É o ponto de entrada pós-login e o hub de navegação para IMP, COMP e PUB.

### Estado atual observado

Score: **54/100 (Parcial)** — baseline em 2026-08-31T21:30:26Z. Gates: lint PASS, test PARTIAL (4 specs de routes), build PASS, e2e MISSING.

Existe uma implementação funcional monolítica em `frontend/libs/proj/src/lib/`:
- Routes lazy-loaded (T02, T08) — `proj.routes.ts`
- Facades signals-based: `LibraryFacade`, `HistoryFacade`
- Ports & Adapters: `PROJETO_PORT`, `PUBLICACAO_PORT` com HTTP + mock adapters
- Componentes OnPush + standalone: `BibliotecaDeProjetosComponent`, `DownloadEHistoricoComponent`
- Models e `proj.providers.ts`

O que está AUSENTE para MVP:
1. Unit tests (façades + componentes sem cobertura — somente 4 smoke specs de routes)
2. Guards nas rotas: `authGuard`, `empresaGuard`, `projProjetoGuard` (comentário `// guards wired by Layer 2` em proj.routes.ts)
3. E2E app `apps/proj-e2e/` não existe
4. Observability Angular (FE-PROJ-023) — deferred P5

### Continuidade da última rodada

Nenhum ciclo plan/implement anterior. Plano inaugural. Tipo: **REPLANEJAMENTO** (primeiro plano, estado parcial).

### Multi-empresa: interceptor `@cordele/shared/access-http-base` configurado?

Sim — o `access-http-base` com interceptor `X-Empresa-Id` já está configurado em `app.config.ts` (verificado pelo baseline: multi-empresa enforcement OK). Tenancy do PROJ é JWT-based (`empresa` claim no token); `X-Empresa-Id` é injetado pelo interceptor shared, não pelo módulo PROJ diretamente. `LibraryFacade` deve observar troca de empresa via `EmpresaContextService` signal (INT-FE-PROJ-002, P1).

---

## 1. Principais achados

### Pontos fortes

- Estrutura hexagonal-FE respeitada: componentes não acessam `HttpClient` diretamente; facades injetam ports.
- Facades signals-based completas: `LibraryFacade` cobre load/retry/onOpen/onQuickDownload; `HistoryFacade` cobre load/onReopen pessimista/409 defensivo/onDownload.
- Arch-conformance 6/6 verde.
- Build e lint passam — nenhuma dívida técnica de compilação.

### Gaps

1. **Cobertura zero** de unit tests em façades e componentes (test PARTIAL: apenas 4 route smoke tests).
2. **Guards ausentes** nas definições de rota: comentário `// guards wired by Layer 2` em `proj.routes.ts` não foi materializado.
3. **E2E inexistente**: `apps/proj-e2e/` não foi criado pelo scaffold — nenhum cenário Playwright executável.
4. **`ProjetoApiService` não existe**: as facades usam `PROJETO_PORT`/`PUBLICACAO_PORT` via adapters HTTP em `src/lib/api/`, mas não a interface `ProjetoApiService` padronizada de `libs/proj/data-access` (FE-PROJ-007/008). Os adapters atuais são funcionais mas não cobrem os 7 endpoints completos nem o mapeamento `ProblemDetail→AppError`.
5. **Estrutura monolítica**: 1 lib `libs/proj/` em vez das 8 sublibaries esperadas (shell-entry, integration, access, data-access, navigation, feature-library, feature-history, ui). Diferido para P7.

### Riscos

- Pitfall `fe-issue-generator:checklist-emoji-markers:unparseable-by-issue_state` (D-611): os arquivos de issue FE-PROJ-*.md usam marcadores emoji (`🔲/✅`) que `plan-state-extractor.py` não consegue parsear. Não bloqueia a implementação, mas impede rastreamento automático de checklist. Registrado como nota.
- Pitfall `fe-nx-register-module:e2e-stub:empty-describe-passes-as-green`: ao criar `apps/proj-e2e/`, **não gerar describes vazios** — cada spec deve ter ao menos um `test()` real ou `test.fixme()` com mensagem descritiva.

### Aderência às regras Nx (boundaries, tax-map, naming)

Módulo atual usa tag `scope:proj` — correto. A estrutura monolítica atual não viola boundaries pois o único projeto é `@cordele/proj`. A refatoração para sublibaries (P7) exigirá definição de `type:shell-entry`, `type:data-access`, `type:feature`, `type:ui`, `type:domain` e atualização de `.eslintrc.json` (RULE-NX-01..07).

---

## 2. Estratégia geral

### Objetivo macro

Elevar o score de 54/100 para ≥ 85/100 cobrindo os gaps críticos de MVP (P1-P3), depois completar a implementação funcional (P4-P6) e por último o refactor estrutural de sublibaries (P7), que não bloqueia nenhuma funcionalidade mas é exigido pelo `generator-config.yml`.

### Ordem das prioridades

| P | Título | Motivo | Issues cobertas |
|---|---|---|---|
| P1 | Unit tests + Guards | Bloqueia MVP: test PARTIAL e rotas desprotegidas | FE-PROJ-017, INT-FE-PROJ-002 |
| P2 | ProjetoApiService + DTOs | Base real de integração: 7 endpoints + AppError | FE-PROJ-007, FE-PROJ-008, FE-PROJ-009, FE-PROJ-010 |
| P3 | E2E (apps/proj-e2e) | Gate e2e MISSING; desbloqueado após P1+P2 | FE-PROJ-024, FE-PROJ-025 |
| P4 | Feature Libs + UI | Completar componentes visuais: card, badge, skeletons, promote | FE-PROJ-012..016, FE-PROJ-018..021 |
| P5 | Shell + Navigation + Observability | Shell integration, breadcrumbs, telemetria Angular | FE-PROJ-005, FE-PROJ-006, FE-PROJ-011, FE-PROJ-023 |
| P6 | LGPD + INT cross-module | LGPD erasure + handoffs IMP/COMP/PUB | FE-PROJ-022, INT-FE-PROJ-001..006 |
| P7 | Refactor → 8 sublibaries | Conformidade ao generator-config.yml — não bloqueia MVP | FE-PROJ-001..006 (reestruturação) |

---

## 3. Plano por prioridade

### Prioridade 1 — Unit tests + Guards

**Status:** pendente
**Issues cobertas:** FE-PROJ-017, INT-FE-PROJ-002
**Categoria:** VALIDACAO + WIRING

#### Objetivo

Atingir test PASS completo com cobertura das facades e componentes, e materializar os guards nas rotas.

#### Problema identificado

1. `proj.routes.ts` declara rotas sem `canActivate`, com comentário `// guards wired by Layer 2 — FE-PROJ-013` (referência errada à issue — o guard correto é FE-PROJ-017).
2. Sem `authGuard` + `empresaGuard`, qualquer rota PROJ é acessível sem autenticação.
3. `LibraryFacade` e `HistoryFacade` têm 0% de cobertura de unit tests.
4. `BibliotecaDeProjetosComponent` e `DownloadEHistoricoComponent` têm 0% de cobertura.

#### Correções mandatórias

**1a — Guard `projProjetoGuard` (FE-PROJ-017)**

Criar `frontend/libs/proj/src/lib/access/proj-projeto.guard.ts` como `CanActivateFn`:
- Ler `:projetoId` de `ActivatedRouteSnapshot.paramMap`.
- Validar UUID formato RFC 4122 via regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
- UUID malformado → `inject(Router).parseUrl('/proj/biblioteca-de-projetos')` imediatamente (sem chamada HTTP).
- UUID bem formado → retornar `true` (a `HistoryFacade.load()` trata o 404 do detail).
- Decisão: **NÃO fazer chamada HTTP no guard** — a HistoryFacade já trata 404 mostrando estado `not-found`. Simplifica o guard e evita chamada duplicada.

**1b — Wiring de guards em `proj.routes.ts` (INT-FE-PROJ-002 parcial)**

Atualizar `frontend/libs/proj/src/lib/proj.routes.ts`:
- Importar `authGuard` de `@cordele/shared/access-http-base` (ou `@cordele/shared/auth-session` — verificar export real do lib).
- Importar `empresaGuard` de `@cordele/shared/empresa-context`.
- Importar `projProjetoGuard` de `./access/proj-projeto.guard`.
- Rota `biblioteca-de-projetos`: `canActivate: [authGuard, empresaGuard]`.
- Rota `projetos/:projetoId/historico`: `canActivate: [authGuard, empresaGuard, projProjetoGuard]`.

**1c — Unit tests `LibraryFacade`**

Criar `frontend/libs/proj/src/lib/library.facade.spec.ts`:
- Setup: `TestBed` com providers mockados para `PROJETO_PORT`, `PUBLICACAO_PORT`, `Router`.
- Teste `load() → status 'ready'`: mock `projetoPort.list()` retorna 2 cards → `status()` = `'ready'`, `projects().length` = 2.
- Teste `load() → status 'empty'`: mock retorna `[]` → `status()` = `'empty'`, `isEmpty()` = `true`.
- Teste `load() → status 'error'`: mock lança erro → `status()` = `'error'`, `error()` não nulo.
- Teste `projects()` computed: card com `ultimoEpubcheckStatus = 'valido'` → `canQuickDownload = true`.
- Teste `onOpen()` → chama `router.navigate` com path correto baseado em `openTarget`.
- Teste `onNewProject()` → chama `router.navigate(['/imp', 'upload'])`.

**1d — Unit tests `HistoryFacade`**

Criar `frontend/libs/proj/src/lib/history.facade.spec.ts`:
- Setup: `TestBed` com mocks de `PROJETO_PORT`, `PUBLICACAO_PORT`, `Router`.
- Teste `load()` → status `'ready'` após detail + publicacoes resolverem.
- Teste `load()` com erro 404 → `status()` = `'not-found'`.
- Teste `load()` com publicacoes falhando → `degraded()` = `true`, `status()` = `'ready'` (api-contract §4.3).
- Teste `onReopen()` pessimista → `reopenPending()` true durante await; após 200 → navega para `/comp`.
- Teste `onReopen()` com 409 → `reopenPending()` volta a `false`, `reopenError()` não nulo.
- Teste `onBack()` → `router.navigate(['/proj', 'biblioteca-de-projetos'])`.

**1e — Unit tests componentes**

Criar `frontend/libs/proj/src/lib/feature-library/biblioteca-de-projetos.component.spec.ts`:
- Smoke: componente instancia sem erros com mocks de `LibraryFacade`.
- Renderiza loading state quando `status = 'loading'`.
- Renderiza empty state quando `isEmpty() = true`.

Criar `frontend/libs/proj/src/lib/feature-history/download-e-historico.component.spec.ts`:
- Smoke: componente instancia sem erros com mocks de `HistoryFacade`.

**1f — Unit test `projProjetoGuard`**

Criar `frontend/libs/proj/src/lib/access/proj-projeto.guard.spec.ts`:
- UUID malformado (`'nao-uuid'`) → resultado é `UrlTree` apontando para `/proj/biblioteca-de-projetos`.
- UUID válido (`'123e4567-e89b-12d3-a456-426614174000'`) → resultado é `true`.

#### Arquivos-alvo (paths completos)

```
frontend/libs/proj/src/lib/access/proj-projeto.guard.ts           (CRIAR)
frontend/libs/proj/src/lib/access/proj-projeto.guard.spec.ts      (CRIAR)
frontend/libs/proj/src/lib/proj.routes.ts                         (EDITAR — adicionar canActivate)
frontend/libs/proj/src/lib/library.facade.spec.ts                 (CRIAR)
frontend/libs/proj/src/lib/history.facade.spec.ts                 (CRIAR)
frontend/libs/proj/src/lib/feature-library/biblioteca-de-projetos.component.spec.ts  (CRIAR)
frontend/libs/proj/src/lib/feature-history/download-e-historico.component.spec.ts    (CRIAR)
```

#### Contrato de tipo (interfaces relevantes)

```typescript
// proj-projeto.guard.ts
import { CanActivateFn } from '@angular/router';
export const projProjetoGuard: CanActivateFn = (route, _state) => { ... };

// UUID_REGEX (RFC 4122)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

#### Sequência de execução

1. data-access: criar `proj-projeto.guard.ts` e seu spec.
2. wiring: editar `proj.routes.ts` adicionando `canActivate` com `authGuard`, `empresaGuard`, `projProjetoGuard`.
3. testes: criar specs de facades (`library.facade.spec.ts`, `history.facade.spec.ts`).
4. testes: criar specs de componentes.
5. validar: `npx nx test proj` PASS — todos os novos specs devem passar.

#### Política de testes

- Unit obrigatório para todas as classes de lógica (facades, guard).
- Componentes: smoke + renderização condicional básica.
- Mocks via `TestBed` com `{ provide: PROJETO_PORT, useValue: mockPort }`.
- Não usar `HttpClientTestingModule` nos testes de facade (o port já é mockado).

#### Multi-empresa

- `authGuard` + `empresaGuard` são de `@cordele/shared` — PROJ não os reimplementa.
- Verificar o path real dos exports de `@cordele/shared/access-http-base` e `@cordele/shared/empresa-context` antes de importar.
- `LibraryFacade` deverá injetar `EmpresaContextService` em P2 para empresaSwitch (INT-FE-PROJ-002 completo).

#### Critérios de aceite

```bash
npx nx test proj --run-in-band    # PASS — todos os specs incluindo os novos
npx nx lint proj                  # PASS
npx nx build proj                 # PASS
# Verificar no output: test suites > 4 (era 1 suite com 4 tests antes)
```

#### Riscos

- `authGuard` e `empresaGuard` podem não estar exportados com esses nomes exatos em `@cordele/shared`. O implementador deve verificar `frontend/libs/comp/src/lib/` e `frontend/libs/imp/` para encontrar o padrão de import já usado em outros módulos antes de criar o import em PROJ.
- `TestBed` com `DestroyRef` requer `TestBed.runInInjectionContext()` ou `TestBed.inject()` dentro do contexto Angular. Usar `jasmine-marbles` ou `rxjs/testing` para Observables nas facades.

#### Instrução para implementador

Criar os arquivos na ordem da sequência acima. Não usar `HttpClientTestingModule` nos testes de facade — injetar diretamente o mock do port via `{ provide: PROJETO_PORT, useValue: { list: () => of([...]) } }`. Para o guard, não fazer chamada HTTP — apenas validar UUID shape. O import de `authGuard`/`empresaGuard` deve espelhar o padrão dos módulos IMP ou COMP (verificar `frontend/libs/imp/src/lib/` ou `frontend/libs/comp/src/lib/` para o padrão exato de import).

---

### Prioridade 2 — ProjetoApiService + DTOs + Facades integradas

**Status:** pendente
**Issues cobertas:** FE-PROJ-007, FE-PROJ-008, FE-PROJ-009, FE-PROJ-010
**Categoria:** FUNCIONAL

#### Objetivo

Criar `ProjetoApiService` padronizado com os 7 endpoints do `proj-service`, DTOs com mapeamento `ProblemDetail→AppError`, e atualizar as facades para usar o service real em vez dos adapters atuais.

#### Problema identificado

Os adapters atuais (`projeto-http.adapter.ts`, `publicacao-http.adapter.ts`) são funcionais mas não seguem o padrão `ProjetoApiService` de `libs/proj/data-access` definido em FE-PROJ-007. Faltam: endpoint `reopen`, endpoint `deleteProjeto` (LGPD — sem UI), e mapeamento de erros `ProblemDetail→AppError`.

#### Correções mandatórias

**2a — `ProjetoApiService`**

Criar `frontend/libs/proj/src/lib/api/projeto-api.service.ts` estendendo ou injetando `@cordele/shared/access-http-base`:
- `listProjetos(): Observable<ProjetoCard[]>` → `GET /api/proj/projetos`
- `getProjeto(id: string): Observable<ProjetoDetail>` → `GET /api/proj/projetos/{id}`
- `listPublicacoes(id: string): Observable<PublicacaoHistoryItem[]>` → `GET /api/proj/projetos/{id}/publicacoes`
- `resolveDownloadUrl(projetoId, publicacaoId): Observable<SignedDownloadUrl>` → `GET /api/proj/projetos/{id}/publicacoes/{pid}/download`
- `reopenProjeto(id: string): Observable<ProjetoDetail>` → `POST /api/proj/projetos/{id}/reopen`
- `deleteProjeto(id: string): Observable<void>` → `DELETE /api/proj/projetos/{id}` (LGPD — sem UI no MVP)

Nunca injetar `HttpClient` diretamente — usar a abstração de `@cordele/shared/access-http-base`.

**2b — DTOs + mappers (FE-PROJ-008)**

Criar `frontend/libs/proj/src/lib/api/proj-api.mappers.ts`:
- `mapProblemDetailToAppError(error: HttpErrorResponse): AppError` — extrai `urn:problem:*` do body e cria `AppError` tipado.
- `mapProjetoCard(raw: unknown): ProjetoCard` — mapear resposta da API para o modelo interno.
- `mapProjetoDetail(raw: unknown): ProjetoDetail` — idem para detail.

**2c — Atualizar facades**

Atualizar `LibraryFacade` para:
- Injetar `EmpresaContextService` (signal empresa ativa) e usar `switchMap` para cancelar e re-emitir request na troca de empresa.
- Usar `ProjetoApiService.listProjetos()` em vez de `projetoPort.list()`.

Atualizar `HistoryFacade` para:
- Usar `ProjetoApiService.getProjeto()`, `ProjetoApiService.listPublicacoes()`, `ProjetoApiService.reopenProjeto()`.

**Nota:** Os providers de `PROJETO_PORT` e `PUBLICACAO_PORT` podem ser mantidos como abstração ou removidos após esta fase — decisão do implementador, desde que não quebre os testes de P1.

#### Arquivos-alvo

```
frontend/libs/proj/src/lib/api/projeto-api.service.ts            (CRIAR)
frontend/libs/proj/src/lib/api/projeto-api.service.spec.ts       (CRIAR)
frontend/libs/proj/src/lib/api/proj-api.mappers.ts               (CRIAR)
frontend/libs/proj/src/lib/library.facade.ts                     (EDITAR — empresaSwitch + ProjetoApiService)
frontend/libs/proj/src/lib/history.facade.ts                     (EDITAR — ProjetoApiService)
frontend/libs/proj/src/lib/library.facade.spec.ts                (EDITAR — adicionar teste empresaSwitch)
```

#### Multi-empresa

Obrigatório: `EmpresaContextService` injetado em `LibraryFacade`; usar `switchMap` (não `mergeMap`) para cancelar request anterior na troca de empresa. `@cordele/shared/empresa-context` é o pacote correto.

#### Critérios de aceite

```bash
npx nx test proj --run-in-band    # PASS — incluindo teste empresa-switch cancelamento
npx nx lint proj                  # PASS
npx nx build proj                 # PASS
```

#### Riscos

- Troca de empresa via `switchMap` exige que `EmpresaContextService` exponha um `Observable<string>` ou `Signal<string>` observável. Se for signal, usar `toObservable()` de `@angular/core/rxjs-interop`.

---

### Prioridade 3 — E2E (apps/proj-e2e)

**Status:** pendente
**Issues cobertas:** FE-PROJ-024, FE-PROJ-025
**Categoria:** VALIDACAO

#### Objetivo

Criar `apps/proj-e2e/` com Playwright e ao menos um test executável por feature (T02 e T08), evitando o pitfall de `describe` vazio que passa como verde.

#### Problema identificado

`apps/proj-e2e/` não existe. Gate e2e MISSING. O pitfall `fe-nx-register-module:e2e-stub:empty-describe-passes-as-green` alerta que describes vazios passam silenciosamente.

#### Correções mandatórias

**3a — Criar projeto Playwright `apps/proj-e2e/`**

Usar o generator Nx para criar o projeto e2e:
```bash
npx nx g @nx/playwright:configuration --project=proj-e2e --directory=apps/proj-e2e
```

Ou criar manualmente seguindo a estrutura dos e2e existentes (verificar `frontend/apps/imp-e2e/` ou `frontend/apps/comp-e2e/` como referência de estrutura).

**3b — Spec T02 (FE-PROJ-024)**

Criar `frontend/apps/proj-e2e/src/biblioteca-de-projetos.spec.ts`:
- `test('exibe lista de projetos quando API retorna dados')`: navega para `/proj/biblioteca-de-projetos`, aguarda elemento `[data-testid="project-card"]` ou equivalente.
- `test('exibe estado vazio quando lista está vazia')`: mock de API retornando `[]`, verificar mensagem de empty state.
- Cenários órfãos adicionais de FE-PROJ-026 podem ser marcados como `test.fixme('cenario X — especificação incompleta')` em vez de omitidos.

**3c — Spec T08 (FE-PROJ-025)**

Criar `frontend/apps/proj-e2e/src/download-e-historico.spec.ts`:
- `test('exibe histórico de publicações para projeto válido')`: navega para `/proj/projetos/{uuid-fake}/historico`, verifica renderização.
- `test('exibe not-found quando projetoId é UUID inválido')`: navega com UUID malformado, verifica redirecionamento para `/proj/biblioteca-de-projetos`.

**Regra obrigatória:** cada arquivo de spec deve ter ao menos 1 `test()` real (não `describe()` vazio). Usar `test.fixme()` para cenários não implementados, nunca `describe(() => {})`.

#### Arquivos-alvo

```
frontend/apps/proj-e2e/project.json                              (CRIAR)
frontend/apps/proj-e2e/playwright.config.ts                      (CRIAR)
frontend/apps/proj-e2e/src/biblioteca-de-projetos.spec.ts        (CRIAR)
frontend/apps/proj-e2e/src/download-e-historico.spec.ts          (CRIAR)
frontend/apps/proj-e2e/tsconfig.json                             (CRIAR)
```

#### Generators Nx obrigatórios

```bash
npx nx g @nx/playwright:configuration --project=proj-e2e
```

Verificar se o generator existe no workspace. Alternativa: copiar estrutura de `apps/imp-e2e/` ou `apps/comp-e2e/` e adaptar os paths.

#### Critérios de aceite

```bash
npx nx e2e proj-e2e    # PASS — ao menos 1 test real por spec file
npx nx lint proj-e2e   # PASS
```

#### Riscos

- O app `cordele-web` precisa estar rodando para os e2e executarem. Verificar `baseURL` no `playwright.config.ts`.
- Se não existir `apps/imp-e2e/` ou similar como referência, verificar a estrutura gerada pelo `@nx/playwright` no projeto antes de criar manualmente.

---

### Prioridade 4 — Feature Libs + UI components

**Status:** pendente
**Issues cobertas:** FE-PROJ-012, FE-PROJ-013, FE-PROJ-014, FE-PROJ-015, FE-PROJ-016, FE-PROJ-018, FE-PROJ-019, FE-PROJ-020, FE-PROJ-021
**Categoria:** FUNCIONAL

#### Objetivo

Completar os componentes visuais: `ProjectCardComponent`, `StatusBadgeComponent`, loading skeletons, error states, e promote completo das telas T02 e T08 com os componentes de UI reutilizáveis.

#### Arquivos-alvo

```
frontend/libs/proj/src/lib/ui/project-card/project-card.component.ts    (CRIAR)
frontend/libs/proj/src/lib/ui/project-card/project-card.component.html  (CRIAR)
frontend/libs/proj/src/lib/ui/status-badge/status-badge.component.ts    (CRIAR)
frontend/libs/proj/src/lib/ui/status-badge/status-badge.component.html  (CRIAR)
frontend/libs/proj/src/lib/ui/skeletons/library-skeleton.component.ts   (CRIAR)
frontend/libs/proj/src/lib/ui/skeletons/history-skeleton.component.ts   (CRIAR)
frontend/libs/proj/src/lib/feature-library/biblioteca-de-projetos.component.ts  (EDITAR)
frontend/libs/proj/src/lib/feature-history/download-e-historico.component.ts    (EDITAR)
```

#### Critérios de aceite

```bash
npx nx test proj    # PASS — testes de renderização condicional de badge (6 tones distintos)
npx nx lint proj    # PASS
npx nx build proj   # PASS
# Verificar: nenhuma ocorrência de oklch( nos templates de produção
```

---

### Prioridade 5 — Shell Integration + Navigation + Observability

**Status:** pendente
**Issues cobertas:** FE-PROJ-005, FE-PROJ-006, FE-PROJ-011, FE-PROJ-023
**Categoria:** WIRING

#### Objetivo

Criar `ProjShellIntegrationService` (breadcrumbs, sidebar), `ProjetoNavigationService` (resolver stage-aware), registrar o módulo no shell, e adicionar telemetria de lifecycle via `@cordele/shared/observability`.

#### Arquivos-alvo

```
frontend/libs/proj/src/lib/shell/proj-shell-integration.service.ts   (CRIAR)
frontend/libs/proj/src/lib/navigation/projeto-navigation.service.ts  (CRIAR)
frontend/apps/cordele-web/src/app/shell/sidebar.component.ts         (EDITAR — registrar PROJ)
frontend/libs/proj/src/lib/observability/proj-lifecycle.service.ts   (CRIAR)
```

#### Critérios de aceite

```bash
npx nx test proj    # PASS
npx nx lint proj    # PASS
npx nx build cordele-web  # PASS
```

---

### Prioridade 6 — LGPD + INT cross-module

**Status:** pendente
**Issues cobertas:** FE-PROJ-022, INT-FE-PROJ-001, INT-FE-PROJ-002, INT-FE-PROJ-003, INT-FE-PROJ-004, INT-FE-PROJ-005, INT-FE-PROJ-006
**Categoria:** FUNCIONAL

#### Objetivo

Implementar `deleteProjeto` (LGPD, sem UI) no `ProjetoApiService`, garantir que os interceptors `@cordele/shared/access-http-base` estão ativos para PROJ, e implementar os handoffs de navegação para IMP, COMP e PUB.

#### Arquivos-alvo

```
frontend/libs/proj/src/lib/api/projeto-api.service.ts     (EDITAR — deleteProjeto já previsto)
frontend/libs/proj/src/lib/feature-library/biblioteca-de-projetos.component.ts  (EDITAR — handoff IMP/COMP)
frontend/libs/proj/src/lib/feature-history/download-e-historico.component.ts    (EDITAR — handoff PUB)
```

#### Critérios de aceite

```bash
npx nx test proj    # PASS
npx nx lint proj    # PASS
```

---

### Prioridade 7 — Refactor monolítico → 8 sublibaries (DIFERIDO)

**Status:** pendente (diferido — pós P6)
**Issues cobertas:** FE-PROJ-001, FE-PROJ-002, FE-PROJ-003, FE-PROJ-004 (reestruturação)
**Categoria:** ESTRUTURAL

#### Objetivo

Migrar da estrutura monolítica `libs/proj/` para as 8 sublibaries definidas em `generator-config.yml`: `libs/proj/shell-entry`, `libs/proj/integration`, `libs/proj/access`, `libs/proj/data-access`, `libs/proj/navigation`, `libs/proj/feature-library`, `libs/proj/feature-history`, `libs/proj/ui`.

#### Motivo do diferimento

A estrutura monolítica atual não bloqueia nenhuma funcionalidade. Arch-conformance 6/6 verde. O refactor só é necessário para conformidade total com o `generator-config.yml`. Diferir para não bloquear MVP.

#### Generators Nx obrigatórios (quando executado)

```bash
npx nx g @nx/angular:library --directory=libs/proj/shell-entry --buildable --tags="scope:proj,type:shell-entry"
npx nx g @nx/angular:library --directory=libs/proj/data-access --buildable --tags="scope:proj,type:data-access"
npx nx g @nx/angular:library --directory=libs/proj/feature-library --buildable --tags="scope:proj,type:feature"
npx nx g @nx/angular:library --directory=libs/proj/feature-history --buildable --tags="scope:proj,type:feature"
npx nx g @nx/angular:library --directory=libs/proj/ui --buildable --tags="scope:proj,type:ui"
npx nx g @nx/angular:library --directory=libs/proj/access --buildable --tags="scope:proj,type:domain"
npx nx g @nx/angular:library --directory=libs/proj/navigation --buildable --tags="scope:proj,type:domain"
npx nx g @nx/angular:library --directory=libs/proj/integration --buildable --tags="scope:proj,type:integration"
```

#### Critérios de aceite

```bash
npx nx affected:lint    # PASS — boundaries corretos para todos os 8 projetos
npx nx affected:test    # PASS
npx nx affected:build   # PASS
python scripts/arch-conformance.py check --layer fe --target frontend/libs/proj  # 8/8 verde
```

---

## 4. Dependências externas

| Dependência | Status | Bloqueia |
|---|---|---|
| `proj-service` API (7 endpoints) | Disponível (imp-service pattern) | P2 |
| `@cordele/shared/access-http-base` | Disponível (configurado em app.config.ts) | P1 |
| `@cordele/shared/empresa-context` (EmpresaContextService) | A verificar export | P1, P2 |
| `@cordele/shared/auth-session` (authGuard) | A verificar — verificar em libs/comp ou libs/imp | P1 |
| `@cordele/comp` (COMP routes para handoff) | Disponível | P6 |
| `@cordele/imp` (IMP routes para handoff) | Disponível | P6 |
| `@cordele/pub` (PUB routes para handoff) | A verificar | P6 |

---

## 5. Restrições arquiteturais

- **RULE-NX-01**: `libs/proj/` não importa de `apps/cordele-web/` (nunca).
- **RULE-NX-02**: Componentes de `libs/proj/ui` não importam de `libs/proj/feature-*` (sentido único).
- **RULE-NX-03**: Facades não importam `HttpClient` diretamente — somente via ports/service.
- **RULE-NX-04**: `@cordele/shared/access-http-base` é o único ponto de emissão HTTP.
- **RULE-NX-05**: Guards de acesso vêm de `@cordele/shared` — PROJ não reimplementa `authGuard` nem `empresaGuard`.
- Boundaries finais após P7: `shell-entry` importa de `data-access`, `feature-*`, `access`, `navigation`; `feature-*` importa de `data-access`, `ui`; `ui` não importa de nenhuma outra sublib PROJ.

---

## 6. Referências

- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` — guards, routes
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` — LibraryVM, HistoryVM
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` — ProjetoApiService, empresa-switch
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/generator-config.yml` — 8 sublibaries esperadas
- `docs/architecture/frontend/modules/proj/frontend/issues/issues_map.md` — mapa completo de issues
- `docs/architecture/frontend/standards/nx-boundaries.md` — RULE-NX-01..07
- `docs/architecture/shared/multi-empresa.md` — EmpresaContextHolder, JWT claim
- `docs/architecture/frontend/modules/proj/frontend/contracts/backend-api-cross-link.md` — contratos de API
