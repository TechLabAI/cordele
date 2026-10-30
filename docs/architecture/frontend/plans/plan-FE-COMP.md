# Plano FE — COMP (Composição) — cordele-web

> Atualizado pelo `/fe-planner` em 2026-08-31 · Tipo: **Continuação**
> Referência canonical: `docs/architecture/frontend/modules/comp/frontend/plans/plan-FE-COMP.md` (backlog original)
> Pipeline trace: tr_72073ac7c2d1

---

## Status das prioridades

| P | Título | Status |
|---|---|---|
| P1 | Foundation (contratos, rotas, descriptor) | DONE |
| P2 | Data access (ApiService, Facades, error mapping) | DONE |
| P3 | Feature libs (T05 e T06 renderizadas) | DONE |
| P4 | Hub integrations (interceptors, guards, access-decision) | DONE |
| P5 | Access guards + Promote cleanup + build fix | DONE |
| P6 | Wiring completion: boundary fix COMP + multi-empresa enforcement | **pendente** |
| P7 | Navigation (breadcrumbs dinâmicos) | pendente |
| P8 | UX Polish (estados loading/error/empty) | pendente |
| P9 | Observability (telemetria de navegação) | pendente |
| P10 | E2E + Hardening (Playwright, EARS coverage) | pendente |

---

## §0 Leitura executiva

**Tipo:** Continuação

P1-P5 completos (26/33 issues DONE). Score 90/100 Maduro. Gates do módulo `comp`: build=PASS, test=PASS, lint=PASS. Gate `cordele-web` lint: FAIL — 5 erros `@nx/enforce-module-boundaries` pré-existentes, dos quais 2 são imputáveis ao COMP (importação estática de biblioteca lazy-loaded). INT-FE-COMP-006 (multi-empresa enforcement) está PARTIAL: interceptor ativo, pero `empresaGuard` ainda não confirmado na cadeia de rotas.

Este plano: resolve o bloqueador de boundary violation COMP-específico e fecha INT-FE-COMP-006 em P6; em seguida executa P7-P10 (Navigation, UX Polish, Observability, E2E).

**Multi-empresa:** `access-http-base` interceptor ativo desde P4 (INT-FE-COMP-001). `empresaGuard` pendente de confirmação em rotas COMP (INT-FE-COMP-006).

---

## §1 Achados

### Estado atual (ES, 2026-08-31T18:07Z)

| Dimensão | Estado |
|---|---|
| Score | 90/100 Maduro |
| Issues DONE | 26/33 |
| gates comp | build PASS · test PASS · lint PASS |
| gates cordele-web | build PASS · lint FAIL (5 erros boundary) |
| Multi-empresa | PARTIAL (interceptor ativo; empresaGuard pendente) |
| P1–P5 | todos DONE |

### Boundary violation — decisão estratégica

**Erros identificados em `npx nx lint cordele-web`:**

```
app.config.ts:17  error  Static imports of lazy-loaded libraries (comp)
app.config.ts:18  error  Static imports of lazy-loaded libraries (proj)
app.config.ts:19  error  Static imports of lazy-loaded libraries (pub)
module-descriptors.ts:20 error  Static imports of lazy-loaded libraries (comp)
module-descriptors.ts:22 error  Static imports of lazy-loaded libraries (imp-shell-entry)
```

**Decisão: corrigir os 2 erros COMP-específicos em P6; registrar os 3 restantes como tech-debt cross-módulo.**

Justificativa:
1. IMP já resolveu o mesmo padrão: `import { provideImp } from '@cordele/imp/data-access'` (não do barrel lazy `@cordele/imp`). O fix para COMP é idêntico: 1 linha em `app.config.ts` + garantir que `@cordele/comp` data-access barrel exporta `provideComp`.
2. Os erros de `proj`, `pub` e `imp-shell-entry` cruzam fronteiras de outros módulos. O COMP planner não é dono deles — serão endereçados pelos planners de PROJ e PUB quando esses módulos rodarem.
3. Deixar os 2 erros COMP-específicos abertos significa que o `cordele-web` lint gate permanece FAIL por causa do COMP mesmo após P10. Isso compromete o sinal de gate do módulo.
4. O fix é cirúrgico (sem refactor arquitetural): mudança de import path + re-exportação no data-access barrel.

**Tech-debt cross-módulo documentado:** Os 3 erros restantes (proj, pub, imp-shell-entry) devem ser tratados pelos planners FE-PROJ e FE-PUB como parte das suas P6+ wiring iterations. Não bloquear COMP P7-P10 por eles.

### Pitfall conhecido (learning-context)

`fe-issue-generator:checklist-emoji-markers:unparseable-by-issue_state` — as issues FE usam emoji `🔲/✅` em vez de `- [ ]/- [x]`, o que quebra o `plan-state-extractor.py`. Não bloqueia execução; o score e estado vêm do ES como fonte primária.

### Gaps ativos

1. Boundary violation COMP-específico (app.config.ts linha 17; module-descriptors.ts linha 20)
2. INT-FE-COMP-006: empresaGuard na cadeia de rotas COMP + cancelamento de facades
3. FE-COMP-023: breadcrumbs com `{nome}` resolvido dinamicamente
4. FE-COMP-024: estados loading/error/empty (skeletons, ErrorState, PreviewEmpty)
5. FE-COMP-025: telemetria (3 eventos metadata-opened, layout-opened, comp-exported)
6. FE-COMP-026/027: Playwright e2e T05 e T06

---

## §2 Estratégia

### Objetivo macro

Elevar o COMP de 90/100 Maduro para 100/100 Completo: resolver o bloqueador de boundary violation COMP-específico, fechar INT-FE-COMP-006, adicionar navigation breadcrumbs dinâmicos, UX polish, observability e cobertura e2e completa (44/44 EARS).

### Ordem das prioridades

| P | Título | Motivo de sequência | Issues cobertas |
|---|---|---|---|
| P6 | Wiring completion: boundary fix + multi-empresa | Bloqueia gate lint cordele-web parcialmente; empresaGuard é requisito de segurança; wiring closes antes do UX | INT-FE-COMP-006 + boundary fix |
| P7 | Navigation breadcrumbs | Funcional de baixo impacto visual; completa FE-COMP-004 com dados reais | FE-COMP-023 |
| P8 | UX Polish | Melhora experiência de erro/vazio antes dos e2e (os testes precisam dos estados corretos) | FE-COMP-024 |
| P9 | Observability | Zero dependência de UI; injeção em service existente | FE-COMP-025 |
| P10 | E2E + Hardening | Portão final; depende de todos os estados e features corretos | FE-COMP-026, FE-COMP-027 |

---

## §3 Plano por prioridade

---

### Prioridade P6 — Wiring completion: boundary fix COMP + multi-empresa enforcement

**Status:** pendente
**Issues cobertas:** INT-FE-COMP-006 + corrective (boundary)
**Categoria:** WIRING

#### Objetivo

Eliminar os 2 erros `@nx/enforce-module-boundaries` de responsabilidade do COMP e garantir que `empresaGuard` está ativo nas rotas COMP com cancelamento de facades na troca de empresa.

#### Problemas identificados

1. `app.config.ts:17` importa `provideComp` de `@cordele/comp` (barrel lazy) em vez de `@cordele/comp/data-access` (pattern já adotado por IMP em linha 16).
2. `module-descriptors.ts` contém static import de símbolo COMP de lib lazy-loaded.
3. INT-FE-COMP-006: `empresaGuard` de `@cordele/shared/empresa-context` não confirmado na cadeia canônica de `comp.routes.ts`; facades devem cancelar requests in-flight com `takeUntilDestroyed`.

#### Correções mandatórias

1. Verificar que `libs/comp/data-access/src/index.ts` (ou `lib/comp.providers.ts`) exporta `provideComp`.
2. Alterar `apps/cordele-web/src/app/app.config.ts` linha 17:
   - Remover: `import { provideComp } from '@cordele/comp';`
   - Substituir por: `import { provideComp } from '@cordele/comp/data-access';`
3. Identificar o static import COMP em `apps/cordele-web/src/app/module-descriptors.ts` e movê-lo para import dinâmico ou extrair o símbolo para sublib não-lazy (ex.: `@cordele/comp/data-access`).
4. Em `libs/comp/data-access/src/lib/comp.routes.ts` ou equivalente: adicionar `empresaGuard` (de `@cordele/shared/empresa-context`) à cadeia de guards das rotas raiz COMP se ausente.
5. Verificar que `MetadataFacade` e `LayoutFacade` (FE-COMP-008, FE-COMP-009) usam `takeUntilDestroyed()` nos observables HTTP — não adicionar se já presente.
6. **Não corrigir** os erros proj/pub/imp-shell-entry — fora do escopo COMP.

#### Arquivos-alvo

```
frontend/apps/cordele-web/src/app/app.config.ts
frontend/apps/cordele-web/src/app/module-descriptors.ts (inspecionar e corrigir import COMP)
frontend/libs/comp/data-access/src/index.ts (garantir exportação de provideComp)
frontend/libs/comp/data-access/src/lib/comp.providers.ts (se provideComp aqui)
frontend/libs/comp/src/lib/comp.routes.ts (adicionar empresaGuard se ausente)
frontend/libs/comp/src/lib/api/metadados-http.adapter.ts (verificar takeUntilDestroyed)
frontend/libs/comp/src/lib/api/layout-http.adapter.ts (verificar takeUntilDestroyed)
```

#### Contrato de tipo

- `empresaGuard`: `CanActivateFn` importado de `@cordele/shared/empresa-context`
- `provideComp`: `EnvironmentProviders` exportado de `@cordele/comp/data-access`
- Nenhuma interface nova criada em P6

#### Sequência de execução

1. Inspecionar `libs/comp/data-access/src/index.ts` — confirmar que `provideComp` já está exportado ou adicioná-lo
2. Corrigir import em `app.config.ts` (1 linha)
3. Inspecionar `module-descriptors.ts` — identificar símbolo COMP lazy e corrigir
4. Verificar e adicionar `empresaGuard` em `comp.routes.ts` se ausente
5. Verificar `takeUntilDestroyed` nas facades (sem alterar se já presente)
6. Rodar `npx nx lint cordele-web` — confirmar redução de 5 para 3 erros (os 3 de proj/pub/imp permanecem)
7. Rodar `npx nx test comp-data-access` — PASS

#### Política de testes

Não são necessários novos testes em P6 além dos existentes. O critério de aceite é gate-based: redução do erro boundary COMP + lint da lib comp continua PASS.

#### Multi-empresa

`empresaGuard` de `@cordele/shared/empresa-context` adicionado à cadeia de rotas. COMP não envia `X-Empresa-Id` no body — o interceptor de `access-http-base` faz isso via token `ACCESS_EMPRESA_ID` (já wired em P4). Não alterar o interceptor.

#### Critérios de aceite

```bash
npx nx lint cordele-web 2>&1 | grep "comp.*lazy\|lazy.*comp" | wc -l   # deve retornar 0
npx nx lint @cordele/comp                                                # PASS (0 erros)
npx nx test comp-data-access                                             # PASS
npx nx build cordele-web                                                 # PASS
```

#### Riscos

- `provideComp` pode já estar apenas no barrel lazy `@cordele/comp` e não reexportado pelo data-access — se `libs/comp/data-access/src/index.ts` não exportar `provideComp`, será necessário mover a declaração para o data-access barrel. Verificar antes de alterar o import em `app.config.ts`.
- `module-descriptors.ts` pode estar importando apenas o tipo/interface do descriptor COMP (não o lazy chunk das rotas) — nesse caso o erro pode ser diferente do esperado. Inspecionar o arquivo antes de alterar.

#### Instrução para implementador

Começar por `libs/comp/data-access/src/index.ts` para confirmar o que é exportado. Se `provideComp` não está lá, mover a declaração (mantendo a função idêntica) para o data-access barrel antes de alterar o app.config.ts. Não tocar nos erros de proj/pub/imp-shell-entry.

---

### Prioridade P7 — Navigation (breadcrumbs dinâmicos)

**Status:** pendente
**Issues cobertas:** FE-COMP-023
**Categoria:** FUNCIONAL

#### Objetivo

`COMP_NAV_CONFIG` com breadcrumb templates T05 (`Projetos › {nome} › Configurar`) e T06 (`Projetos › {nome} › Edição`) resolvendo `{nome}` dinamicamente a partir do `projetoId` de rota.

#### Problemas identificados

`FE-COMP-023`: `comp-nav.config.ts` existe (criado em FE-COMP-004) mas `{nome}` não é resolvido dinamicamente — é um placeholder estático. `CompShellIntegrationService.register()` precisa instalar o config com resolução dinâmica.

#### Correções mandatórias

1. Em `libs/comp/navigation/src/lib/comp-nav.config.ts`: definir `COMP_NAV_CONFIG` com os 4 steps do pipeline (`importar`, `configurar`, `edicao`, `exportar`) e breadcrumb templates com `{nome}`.
2. Em `CompShellIntegrationService` (FE-COMP-004): implementar resolução de `{nome}` a partir de `ActivatedRoute` params ou de um `ProjFacade.currentProjectName$` se disponível, substituindo `{nome}` no breadcrumb antes de instalar no `NavigationService`.
3. Não criar nova injeção de `ProjFacade` se não existir — usar `ActivatedRoute.snapshot.params['projetoId']` como fallback legível.

#### Arquivos-alvo

```
frontend/libs/comp/navigation/src/lib/comp-nav.config.ts
frontend/libs/comp/src/lib/feature-configuracoes/configuracoes.component.ts (consumidor)
frontend/libs/comp/src/lib/feature-editor/editor-de-layout-preview.component.ts (consumidor)
```

#### Contrato de tipo

```typescript
// comp-nav.config.ts
export const COMP_NAV_CONFIG: CompNavConfig = {
  steps: [
    { id: 'importar',    label: 'Importar',   state: 'done'    },
    { id: 'configurar',  label: 'Configurar', state: 'active'  },
    { id: 'edicao',      label: 'Edição',     state: 'pending' },
    { id: 'exportar',    label: 'Exportar',   state: 'pending' },
  ],
  breadcrumbs: {
    'configurar': ['Projetos', '{nome}', 'Configurar'],
    'edicao':     ['Projetos', '{nome}', 'Edição'],
  },
};
```

#### Sequência de execução

1. data-access: atualizar `comp-nav.config.ts` com estrutura completa
2. feature: injetar resolução de `{nome}` em `CompShellIntegrationService`
3. wiring: verificar que `register()` é chamado no `ngOnInit` dos smart components T05/T06

#### Critérios de aceite

```bash
npx nx lint @cordele/comp          # PASS
npx nx test comp-data-access       # PASS
npx nx build cordele-web           # PASS
# manual: navegar para T05 e T06; breadcrumb mostra projetoId (ou nome) — não "{nome}" literal
```

#### Riscos

`NavigationService` de `@cordele/shared/ui-components` pode não suportar breadcrumbs parametrizados — verificar interface antes de implementar a resolução dinâmica.

#### Instrução para implementador

Verificar o contrato de `NavigationService` antes de implementar resolução. Se `NavigationService` não aceita `breadcrumbs` como array de strings, usar a interface existente de forma idiomática (ex.: `setTitle`, `setBreadcrumb`).

---

### Prioridade P8 — UX Polish (estados loading/error/empty)

**Status:** pendente
**Issues cobertas:** FE-COMP-024
**Categoria:** FUNCIONAL

#### Objetivo

T05 e T06 com estados de loading (skeleton CLS-safe), erro (ErrorState com retry) e vazio (PreviewEmpty) corretamente implementados conforme SPEC-02 §1/§2 e SPEC-07 §3.

#### Problemas identificados

`FE-COMP-024`: Os smart components T05/T06 têm wiring de dados mas não têm os `@if status='loading'` / `@if status='error'` / `@if status='empty'` diferenciados com componentes dedicados. `MetadataSkeletonComponent`, `PreviewSkeletonComponent` e `PreviewEmptyComponent` não existem.

#### Correções mandatórias

1. Criar `MetadataSkeletonComponent` em `libs/comp/ui/src/lib/`: skeleton do formulário T05 (campos cinza placeholder). Standalone. CLS-safe (altura igual ao formulário real).
2. Criar `PreviewSkeletonComponent` em `libs/comp/ui/src/lib/`: skeleton do canvas T06 + painel de estilos. Standalone.
3. Criar `PreviewEmptyComponent` em `libs/comp/ui/src/lib/`: "Ainda não há manuscrito para pré-visualizar." com botão "Voltar ao Importar". O painel de estilos permanece visível.
4. Garantir que `ErrorStateComponent` de `@cordele/shared/ui-feedback` é importado (não criado) nas feature libs com `correlationId` do erro.
5. Atualizar templates de `ConfiguracoesComponent` e `EditorDeLayoutPreviewComponent`: adicionar `@if (facade.status() === 'loading')`, `@if (facade.status() === 'error')`, `@if (facade.status() === 'empty')` com os componentes corretos.

#### Arquivos-alvo

```
frontend/libs/comp/ui/src/lib/metadata-skeleton/metadata-skeleton.component.ts (criar)
frontend/libs/comp/ui/src/lib/preview-skeleton/preview-skeleton.component.ts (criar)
frontend/libs/comp/ui/src/lib/preview-empty/preview-empty.component.ts (criar)
frontend/libs/comp/ui/src/index.ts (re-exportar os novos)
frontend/libs/comp/src/lib/feature-configuracoes/configuracoes.component.ts
frontend/libs/comp/src/lib/feature-editor/editor-de-layout-preview.component.ts
```

#### Contrato de tipo

```typescript
// metadata-skeleton.component.ts
@Component({ selector: 'cordele-metadata-skeleton', standalone: true, ... })
export class MetadataSkeletonComponent {}

// preview-empty.component.ts
@Component({ selector: 'cordele-preview-empty', standalone: true, ... })
export class PreviewEmptyComponent {
  readonly navigateBack = output<void>();
}
```

#### Sequência de execução

1. Criar os 3 componentes em `libs/comp/ui/src/lib/`
2. Exportá-los em `libs/comp/ui/src/index.ts`
3. Atualizar templates dos smart components com os `@if` corretos
4. Rodar `npx nx test comp-feature-metadata` e `npx nx test comp-feature-layout`

#### Critérios de aceite

```bash
npx nx test comp-feature-metadata    # PASS
npx nx test comp-feature-layout      # PASS
npx nx lint @cordele/comp            # PASS
npx nx build cordele-web             # PASS
grep -r 'MetadataSkeletonComponent\|PreviewSkeletonComponent\|PreviewEmptyComponent' frontend/libs/comp/ui/src/index.ts  # 3 hits
```

#### Riscos

`@cordele/shared/ui-feedback` pode não exportar `ErrorStateComponent` — verificar `libs/shared/ui-feedback/src/index.ts` antes de importar. Se não existir, criar placeholder local em `libs/comp/ui`.

#### Instrução para implementador

Não criar `ErrorStateComponent` em `libs/comp/` — ele vem de `@cordele/shared/ui-feedback`. Verificar que a tag Nx de `comp/ui` permite importar `shared/ui-feedback` antes de adicionar o import.

---

### Prioridade P9 — Observability (telemetria de navegação)

**Status:** pendente
**Issues cobertas:** FE-COMP-025
**Categoria:** FUNCIONAL

#### Objetivo

`CompShellIntegrationService` emite 3 eventos de telemetria: `metadata-opened`, `layout-opened`, `comp-exported` via `@cordele/shared/observability`.

#### Problemas identificados

`FE-COMP-025`: sem `ObservabilityService` injetado em `CompShellIntegrationService`. Os 3 pontos de emissão não estão implementados.

#### Correções mandatórias

1. Injetar `ObservabilityService` de `@cordele/shared/observability` em `CompShellIntegrationService`.
2. Implementar métodos:
   - `trackMetadataOpened(projetoId: string): void` — chamado no `ngOnInit` de `ConfiguracoesComponent`
   - `trackLayoutOpened(projetoId: string): void` — chamado no `ngOnInit` de `EditorDeLayoutPreviewComponent`
   - `trackCompExported(projetoId: string): void` — chamado na facade `LayoutFacade.export()` em sucesso
3. Cada evento inclui `{ projetoId, correlationId, timestamp }` — sem dados PII.

#### Arquivos-alvo

```
frontend/libs/comp/src/lib/feature-configuracoes/configuracoes.component.ts
frontend/libs/comp/src/lib/feature-editor/editor-de-layout-preview.component.ts
frontend/libs/comp/src/lib/api/layout-http.adapter.ts (ponto de sucesso de export)
```

#### Contrato de tipo

```typescript
// Assinatura dos métodos em CompShellIntegrationService
trackMetadataOpened(projetoId: string): void;
trackLayoutOpened(projetoId: string): void;
trackCompExported(projetoId: string): void;
```

#### Sequência de execução

1. Verificar que `@cordele/shared/observability` exporta `ObservabilityService`
2. Injetar e implementar os 3 métodos em `CompShellIntegrationService`
3. Chamar nos pontos corretos (ngOnInit / sucesso de export)
4. Rodar lint + test

#### Critérios de aceite

```bash
npx nx lint @cordele/comp            # PASS
npx nx test comp-data-access         # PASS
grep -r 'trackMetadataOpened\|trackLayoutOpened\|trackCompExported' frontend/libs/comp/ | wc -l  # >= 3 hits
```

#### Riscos

`@cordele/shared/observability` pode não existir ainda (lib pendente de scaffold). Se não existir: declarar `ObservabilityService` como interface stub local `libs/comp/data-access/src/lib/observability.stub.ts` com flag `isMock: true` e emitir `console.debug` — não bloquear P9.

#### Instrução para implementador

Verificar `frontend/libs/shared/` por `observability`. Se não existir, usar o stub conforme risco acima e registrar como tech-debt em comentário `// TODO: substituir por @cordele/shared/observability quando disponível`.

---

### Prioridade P10 — E2E + Hardening (Playwright, EARS coverage)

**Status:** pendente
**Issues cobertas:** FE-COMP-026, FE-COMP-027
**Categoria:** VALIDACAO

#### Objetivo

`npx nx e2e comp-e2e` PASS; `fe-ears-coverage` gate exit 0; 44/44 EARS cobertas (10 grupos T05 + 9 grupos T06).

#### Problemas identificados

`FE-COMP-026/027`: specs Playwright não implementadas. O projeto Nx `comp-e2e` foi registrado em P5 (FE-COMP-019 — guards em vigor). Os `.feature` files em SPEC-08 existem; as spec.ts geradas podem ter describes vazios (pitfall `fe-nx-register-module:e2e-stub:empty-describe-passes-as-green` — registrado em learning-context).

#### Correções mandatórias (P10)

1. Implementar `apps/comp-e2e/src/e2e/configuracoes.spec.ts` a partir de `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-08.md §1` (10 grupos de cenários T05).
2. Implementar `apps/comp-e2e/src/e2e/editor-de-layout-preview.spec.ts` a partir de SPEC-08 §2 (9 grupos T06).
3. Usar Page Objects `CompConfigPage` e `LayoutEditorPage` com seletores semânticos.
4. Mockar respostas HTTP via Playwright `route.fulfill()` para simular: `materialized:false`, `413`, `415`, `5xx`, `403`, `404`, `409`.
5. Cobrir slugs EARS listados em FE-COMP-026 e FE-COMP-027 (44 slugs total).
6. **Pitfall mitigation:** se os `.spec.ts` gerados têm `test.describe('...', () => {})` vazio, substituir por implementação real — não deixar describe vazio que passa verde silenciosamente.

#### Arquivos-alvo

```
frontend/apps/comp-e2e/src/e2e/configuracoes.spec.ts
frontend/apps/comp-e2e/src/e2e/editor-de-layout-preview.spec.ts
frontend/apps/comp-e2e/src/support/comp-config.page.ts (Page Object T05)
frontend/apps/comp-e2e/src/support/layout-editor.page.ts (Page Object T06)
```

#### Sequência de execução

1. Verificar estado atual dos spec.ts em `comp-e2e/src/e2e/` (descartar describes vazios)
2. Implementar Page Objects
3. Implementar `configuracoes.spec.ts` (T05 — 10 grupos)
4. Implementar `editor-de-layout-preview.spec.ts` (T06 — 9 grupos)
5. Rodar `npx nx e2e comp-e2e` (requer dev server e MSW ou Playwright route mock)

#### Política de testes

E2E obrigatório. Unit tests dos Page Objects não são necessários. Rodar `fe-ears-coverage` ao final para confirmar 44/44.

#### Critérios de aceite

```bash
npx nx e2e comp-e2e                  # PASS (todos cenários T05 + T06)
python scripts/gates-run.py --layer fe --target frontend/libs/comp  # PASS
# fe-ears-coverage gate exit 0 (44/44 EARS cobertas)
grep -r 'test.describe' frontend/apps/comp-e2e/src/e2e/ | grep -v 'it\|test(' | wc -l  # 0 (sem describes vazios)
```

#### Riscos

1. **Pitfall describes vazios** (learning-context): inspecionar arquivos .spec.ts antes de implementar.
2. **Playwright + devserver**: `comp-e2e` requer o app rodando. Em CI, usar `--baseUrl` de build estático.
3. **`fe-ears-coverage` gate**: verificar se o script existe em `scripts/`; se não, o gate é `grep` manual dos slugs EARS nos spec.ts.

#### Instrução para implementador

Começar inspecionando os arquivos `.spec.ts` existentes em `comp-e2e/src/e2e/`. Se tiverem `test.describe('...', () => {})` vazio, apagar o conteúdo e reescrever do zero. Não reutilizar stubs vazios — eles passam verde sem testar nada.

---

## §4 Dependências externas

| Dependência | Status | P bloqueada |
|---|---|---|
| `@cordele/shared/empresa-context` exporta `empresaGuard` | deve existir (P4 wired) | P6 |
| `@cordele/shared/ui-feedback` exporta `ErrorStateComponent` | verificar | P8 |
| `@cordele/shared/observability` exporta `ObservabilityService` | verificar | P9 |
| Rota PUB `/exportacao-e-validacao` existe para "Exportar" | INT-FE-COMP-004 (P4 done) | P10 |
| `comp-e2e` Nx project registrado | P5 done (FE-COMP-019) | P10 |

---

## §5 Restrições arquiteturais (Nx boundaries)

- `libs/comp/ui` pode importar `shared/ui-feedback` e `shared/ui-tokens` — verificar tags permitidas em `frontend/.eslintrc.json` antes de P8.
- `libs/comp/data-access` **não** pode importar `libs/comp/feature-*` (boundary direction).
- `apps/cordele-web` importa providers COMP via `@cordele/comp/data-access` (não via barrel lazy `@cordele/comp`) após P6.
- Os 3 erros restantes (proj/pub/imp-shell-entry) são de responsabilidade dos planners FE-PROJ e FE-PUB.

---

## §6 Tech-debt cross-módulo registrado

**Boundary violations remanescentes após P6 (não COMP):**

| Arquivo | Lib afetada | Planner responsável |
|---|---|---|
| `app.config.ts:18` | `@cordele/proj` | FE-PROJ planner |
| `app.config.ts:19` | `@cordele/pub` | FE-PUB planner |
| `module-descriptors.ts:22` | `imp-shell-entry` | FE-IMP planner |

Esses 3 erros persistirão no `cordele-web` lint até que os planners de PROJ, PUB e IMP os resolvam, seguindo o mesmo padrão: importar `provide*` da sublib `data-access` em vez do barrel lazy.

---

## §7 Referências

- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md`
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md`
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md`
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-08-e2e-scenarios.md`
- `docs/architecture/frontend/modules/comp/frontend/issues/INT-FE-COMP-006.md`
- `docs/architecture/frontend/standards/nx-boundaries.md`
- `docs/architecture/shared/multi-empresa.md`
