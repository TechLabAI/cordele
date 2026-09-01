<!-- OUTPUT-SCHEMA
- Status
- §0 Leitura executiva
- §1 Achados
- §2 Estratégia
- §3 Prioridades
- §4 Dependencias externas
- §5 Restricoes arquiteturais
-->

# Plano FE — IMP (Importação) — cordele-web

## Status

**Tipo:** Replanejamento completo
**Resumo:** Módulo IMP em score 5/100 (Inicial). Bloqueador estrutural: 1 lib monolítica vs 8 sublibs Nx esperadas pelo `generator-config.yml`. Nenhuma prioridade funcional pode ser executada com boundaries corretas até que o scaffold Nx crie os 8 projects, configure as tags e migre o código existente.

Prioridades: P1 — pendente (SCAFFOLD NX — BLOQUEADOR ESTRUTURAL) | P2 — pendente (DATA ACCESS + MULTI-EMPRESA) | P3 — pendente (SHELL ENTRY + BOOTSTRAP) | P4 — pendente (FEATURE LIBS — UPLOAD + REVIEW) | P5 — pendente (GUARDS + NAVEGACAO + INTEGRATION) | P6 — pendente (UX POLISH + OBSERVABILIDADE) | P7 — pendente (E2E PLAYWRIGHT)

---

## §0 Leitura executiva

O módulo IMP implementa as telas T03 (Upload de manuscrito, `/imp/upload`) e T04 (Revisão de estrutura, `/imp/manuscritos/:manuscritoId/revisao`). O baseline de 2026-08-31 revelou score 5/100: há prototipagem técnica de qualidade (ImportFacade com signals, UploadComponent standalone/OnPush, Port/Adapter pattern em `api/`), mas sem nenhuma sublib Nx scoped, sem boundaries configuradas, sem testes, sem multi-empresa wired e 31 issues todas ABERTA.

O plano resolve o bloqueador estrutural em P1 (criar os 8 projects Nx e migrar o código existente), depois executa o caminho crítico: data-access + multi-empresa (P2), shell-entry + bootstrap (P3), feature-upload e feature-review completas (P4), guards + navegação + integration (P5), UX polish + observabilidade (P6), e2e Playwright (P7).

Multi-empresa: o módulo emite HTTP — `@cordele/shared/access-http-base` deve ser wired no data-access (P2) via `ImpHttpClient extends AccessHttpClient`; nenhum `HttpClient` nu pode aparecer em nenhuma lib IMP.

---

## §1 Achados

Estado consolidado do baseline 2026-08-31 (score 5/100 — Inicial): 31 issues todas ABERTA; 1 lib monolítica vs 8 sublibs esperadas; 0 testes; multi-empresa bloqueada.

### Pontos fortes
- `ImportFacade` (`frontend/libs/imp/src/lib/import.facade.ts`): signals-first correto (`signal()`, `asReadonly()`, `takeUntilDestroyed()`); UploadPhase definida; mock adapter funcional.
- `UploadComponent` (`frontend/libs/imp/src/lib/feature-upload/upload.component.ts`): standalone, `ChangeDetectionStrategy.OnPush`, promovido do protótipo, conectado à ImportFacade.
- Port/Adapter pattern correto em `api/`: `ManuscritoPort`, `ManuscritoHttpAdapter`, `ManuscritoMockAdapter`, análogo para `SegmentoCuradoria`.
- `imp.routes.ts` e `imp.providers.ts` esboçados (rascunho); estrutura de DI legível.

### Gaps críticos
1. **ESTRUTURAL**: 1 lib monolítica (`frontend/libs/imp/`) vs 8 projetos Nx esperados (`generator-config.yml` §libs). Sem os 8 projects, boundaries Nx não podem ser enforçadas e nenhuma issue pode ser fechada em conformidade.
2. **MULTI-EMPRESA BLOQUEADA**: `@cordele/shared/access-http-base` não configurado; headers `X-Empresa-Id` ausentes em todos os requests HTTP. Bloqueio: INT-FE-IMP-001.
3. **Addendum M4 ausente**: endpoints ignore/confirm (FE-IMP-009) não implementados; ReviewFacade (FE-IMP-011) depende deles; e2e rollback (FE-IMP-025) bloqueado.
4. **Testes zero**: `imp.routes.spec.ts` existe mas vazio; cobertura 0%.
5. **E2E MISSING**: `apps/imp-e2e` não existe; 0/18 cenários Playwright.
6. **Shell não registrado**: IMP não visível em `cordele-web`; FE-IMP-003/005 MISSING.

### Riscos de pitfall conhecidos (learning-context)
- **fe-nx-register-module:e2e-stub:vacuous-assertion**: stubs Playwright gerados com `await expect(page).toHaveURL(/.*/)` sob `test.skip()` — ao remover o skip sem trocar a asserção o teste vira falso verde. Implementador deve usar `test.fixme()` em P7.
- **fe-issue-generator:checklist-emoji-markers:unparseable**: issues FE usam marcadores emoji (`🔲`/`✅`) não parseáveis pelo `issue_state.py`. `plan-state-extractor.py` sai com exit 2 para todas as issues IMP. Implementador deve declarar conclusão de issue no próprio relatório de fase.
- **fe-architect-promote:app-theme:design-system-not-vendorized**: se UploadComponent ou RevisaoDeEstruturaComponent importam classes CSS do protótipo que não existem em `frontend/apps/cordele-web/src/styles/theme.css`, o build fica verde mas a UI fica sem estilos. Verificar tokens em P4.

### Aderência às regras Nx (boundaries, tax-map, naming)
- **RULE-NX-01** (scope boundary): não aplicável hoje — lib monolítica não tem enforce.
- **RULE-NX-02** (type hierarchy): `feature` não pode importar outro `feature` — validar em P4.
- **RULE-NX-03** (shared only via `shared/`): acesso a `empresa-context` deve passar por `@cordele/shared/empresa-context` — validar em P2 e P5.
- **Naming**: libs devem usar slug `imp-<sublib>` como nome Nx (ex: `imp-data-access`, `imp-feature-upload`); importPath `@cordele/imp/<sublib>`.

---

## §2 Estratégia

Replanejamento completo em 7 prioridades sequenciais: P1 desbloqueia a estrutura Nx, P2-P6 implementam funcionalidade por camada, P7 fecha com e2e como gate de qualidade.

### Objetivo macro
Criar a estrutura Nx correta (P1), implementar a camada de dados com multi-empresa (P2), registrar o módulo no shell (P3), entregar as features completas com testes (P4), fechar guards e integração (P5), polish e observabilidade (P6), e2e como gate final (P7). Score alvo: >= 80/100 ao término de P7.

### Ordem das prioridades

| P | Título | Motivo | Issues cobertas | Categoria |
|---|---|---|---|---|
| P1 | Scaffold Nx — 8 sublibs scoped | Bloqueador estrutural; sem boundaries nenhuma issue fecha em conformidade | — (infra) | ESTRUTURAL |
| P2 | Data Access + Multi-empresa | Fundação da camada de dados; interceptor X-Empresa-Id; ImportFacade testado; ReviewFacade + M4 | FE-IMP-006..011, INT-FE-IMP-001..002 | FUNCIONAL + WIRING |
| P3 | Shell Entry + Bootstrap | Contract, permissions, feature-flags, descriptor, registro no shell | FE-IMP-001..005 | WIRING |
| P4 | Feature Libs (Upload + Review) | Telas T03 e T04 completas; componentes presentacionais; confirm → COMP | FE-IMP-012..018, FE-IMP-022, INT-FE-IMP-003 | FUNCIONAL |
| P5 | Guards + Navegação + Integration | impProjetoGuard; StepBar; BreadcrumbDynamic; ImpShellIntegrationService; shared bridges | FE-IMP-019..020, INT-FE-IMP-004..006 | WIRING |
| P6 | UX Polish + Observabilidade | Error mapper; telemetria lifecycle events | FE-IMP-021, FE-IMP-023 | FUNCIONAL |
| P7 | E2E Playwright | imp-e2e project; 18 cenários T03/T04; EARS | FE-IMP-024..025 | VALIDACAO |

---

## §3 Prioridades

7 prioridades sequenciais. P1 é bloqueador estrutural; P2-P7 são funcionais/wiring/validação. Cada prioridade lista arquivos-alvo com paths completos.

---

### Prioridade 1 — Scaffold Nx: 8 sublibs scoped + migração de código

**Status:** pendente
**Issues cobertas:** infra (desbloqueia todas as 31 issues)
**Categoria:** ESTRUTURAL

#### Objetivo
Criar os 8 projetos Nx (`scope:imp`) definidos em `generator-config.yml`, configurar path aliases em `tsconfig.base.json`, configurar boundaries no ESLint, e migrar o código existente de `frontend/libs/imp/src/lib/` para as sublibs corretas.

#### Problema
`generator-config.yml` §libs declara 8 projetos Nx. Existe apenas `frontend/libs/imp/` com `project.json` de tags `[scope:imp, type:feature]`. Sem os 8 projects, `npx nx lint` não detecta violações de boundary e qualquer código adicionado em P2+ ficará em local errado.

#### Resultado esperado
- 8 diretórios `frontend/libs/imp/<sublib>/` com `project.json` e tags corretas.
- Path aliases `@cordele/imp/<sublib>` em `frontend/tsconfig.base.json`.
- ESLint boundary rules para `scope:imp` em `frontend/.eslintrc.json`.
- Código migrado: adapters e ports em `imp-data-access`, UploadComponent em `imp-feature-upload`, RevisaoDeEstruturaComponent rascunho em `imp-feature-review`, facades em `imp-data-access`.
- `frontend/libs/imp/` original removida (ou esvaziada a `src/lib/`, mantendo apenas barrel de re-export para `imp-shell-entry`).
- `npx nx build imp-data-access` PASS; `npx nx lint imp-data-access` PASS.

#### Correcoes mandatorias

1. Criar 8 libs Nx com `nx generate`:

```
npx nx g @nx/angular:library --directory=libs/imp/shell-entry   --name=imp-shell-entry   --importPath=@cordele/imp/shell-entry   --tags="scope:imp,type:app"        --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/access        --name=imp-access        --importPath=@cordele/imp/access        --tags="scope:imp,type:domain"     --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/data-access   --name=imp-data-access   --importPath=@cordele/imp/data-access   --tags="scope:imp,type:data-access" --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/feature-upload --name=imp-feature-upload --importPath=@cordele/imp/feature-upload --tags="scope:imp,type:feature" --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/feature-review --name=imp-feature-review --importPath=@cordele/imp/feature-review --tags="scope:imp,type:feature" --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/integration   --name=imp-integration   --importPath=@cordele/imp/integration   --tags="scope:imp,type:domain"     --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/navigation    --name=imp-navigation    --importPath=@cordele/imp/navigation    --tags="scope:imp,type:domain"     --buildable --standalone
npx nx g @nx/angular:library --directory=libs/imp/ui            --name=imp-ui            --importPath=@cordele/imp/ui            --tags="scope:imp,type:ui"         --buildable --standalone
```

2. Migrar arquivos existentes de `frontend/libs/imp/src/lib/` para os destinos:

| Arquivo atual | Destino |
|---|---|
| `api/manuscrito.port.ts` | `frontend/libs/imp/data-access/src/lib/ports/manuscrito.port.ts` |
| `api/manuscrito-http.adapter.ts` | `frontend/libs/imp/data-access/src/lib/adapters/manuscrito-http.adapter.ts` |
| `api/manuscrito-mock.adapter.ts` | `frontend/libs/imp/data-access/src/lib/adapters/manuscrito-mock.adapter.ts` |
| `api/segmento-curadoria.port.ts` | `frontend/libs/imp/data-access/src/lib/ports/segmento-curadoria.port.ts` |
| `api/segmento-curadoria-http.adapter.ts` | `frontend/libs/imp/data-access/src/lib/adapters/segmento-curadoria-http.adapter.ts` |
| `api/segmento-curadoria-mock.adapter.ts` | `frontend/libs/imp/data-access/src/lib/adapters/segmento-curadoria-mock.adapter.ts` |
| `models/imp.models.ts` | `frontend/libs/imp/data-access/src/lib/models/imp.models.ts` |
| `import.facade.ts` | `frontend/libs/imp/data-access/src/lib/import.facade.ts` |
| `review.facade.ts` | `frontend/libs/imp/data-access/src/lib/review.facade.ts` (rascunho — completar em P2) |
| `imp.providers.ts` | `frontend/libs/imp/data-access/src/lib/imp.providers.ts` |
| `imp.routes.ts` | `frontend/libs/imp/shell-entry/src/lib/imp.routes.ts` (stub — completar em P3) |
| `feature-upload/upload.component.ts` | `frontend/libs/imp/feature-upload/src/lib/upload/upload.component.ts` |
| `feature-review/revisao-de-estrutura.component.ts` | `frontend/libs/imp/feature-review/src/lib/revisao-de-estrutura/revisao-de-estrutura.component.ts` |

3. Esvaziar `frontend/libs/imp/src/lib/` e atualizar `frontend/libs/imp/src/index.ts` para re-exportar apenas de `@cordele/imp/shell-entry` (barrel público do módulo).

4. Adicionar boundary rules em `frontend/.eslintrc.json` (ou `frontend/eslint.config.js`):
   - `type:feature` pode importar `type:data-access`, `type:domain`, `type:ui`.
   - `type:feature` **não** pode importar outro `type:feature`.
   - `type:data-access` pode importar `type:domain`; **não** pode importar `type:feature` ou `type:app`.
   - `type:app` pode importar tudo dentro de `scope:imp`.
   - `scope:imp` pode importar `scope:shared`; **não** pode importar `scope:comp`, `scope:pub`, `scope:proj`.

#### Arquivos-alvo
- `frontend/libs/imp/data-access/src/lib/` (ports, adapters, models, facades)
- `frontend/libs/imp/feature-upload/src/lib/upload/upload.component.ts`
- `frontend/libs/imp/feature-review/src/lib/revisao-de-estrutura/revisao-de-estrutura.component.ts`
- `frontend/libs/imp/shell-entry/src/lib/imp.routes.ts` (stub)
- `frontend/libs/imp/src/index.ts` (barrel do lib monolítico legado)
- `frontend/tsconfig.base.json` (path aliases gerados pelo nx g)
- `frontend/.eslintrc.json` (boundary rules)

#### Generators Nx obrigatorios
Ver comandos acima em "Correcoes mandatorias §1".

#### Politica de testes
Nesta fase: apenas verificar que `nx build` e `nx lint` passam para cada sublib criada. Testes unitários começam em P2.

#### Multi-empresa
Nesta fase: apenas criar as sublibs. A injeção de `access-http-base` acontece em P2 (`imp-data-access`).

#### Criterios de aceite
```bash
npx nx build imp-data-access        # PASS
npx nx build imp-feature-upload     # PASS
npx nx build imp-feature-review     # PASS
npx nx lint imp-data-access         # PASS (sem violações de boundary)
npx nx lint imp-feature-upload      # PASS
npx nx lint imp-feature-review      # PASS
```
Adicionalmente: `frontend/libs/imp/src/lib/` deve estar vazio (sem arquivos `.ts` remanescentes fora do `index.ts` barrel).

#### Riscos
- O `nx g @nx/angular:library` pode conflitar com o `project.json` existente de `libs/imp/` se o Nx tratar `imp` como nome reservado. Solução: renomear o projeto monolítico de `imp` para `imp-legacy` temporariamente no `project.json` antes de criar as sublibs; removê-lo ao fim.
- O UploadComponent promovido pode importar classes CSS do protótipo ausentes em `theme.css`. Verificar imports CSS no momento da migração; se ausentes, substituir por classes do `@cordele/shared/ui-theme`.

#### Instrucao para implementador
Criar os 8 projetos Nx com os comandos exatos acima. Mover os arquivos listados na tabela para os destinos exatos. Atualizar imports em cada arquivo movido. Verificar que `npx nx lint imp-data-access` não reporta boundary violations. Não implementar nenhuma nova funcionalidade nesta fase.

---

### Prioridade 2 — Data Access + Multi-empresa

**Status:** pendente
**Issues cobertas:** FE-IMP-006, FE-IMP-007, FE-IMP-008, FE-IMP-009, FE-IMP-010, FE-IMP-011, INT-FE-IMP-001, INT-FE-IMP-002
**Categoria:** FUNCIONAL + WIRING

#### Objetivo
Completar a camada `imp-data-access` com DTOs conformes ao contrato BE, wiring do interceptor `@cordele/shared/access-http-base` (headers `X-Empresa-Id`), ImportFacade testada, ReviewFacade completa com Addendum M4 (ignore/confirm endpoints), e DTOs de histórico.

#### Problema
- `ManuscritoHttpAdapter` usa `HttpClient` nu — sem `X-Empresa-Id` nos headers (INT-FE-IMP-001 bloqueador).
- ReviewFacade é rascunho sem rollback de ignore otimístico (FE-IMP-011, Addendum M4).
- ImportFacade tem 0 testes (FE-IMP-010 PARTIAL).
- `segmento-curadoria-http.adapter.ts` não testado (FE-IMP-008).
- DTOs de histórico (`ManuscritoHistory`, lista de manuscritos por projeto) não implementados (FE-IMP-008).

#### Resultado esperado
- `ImpHttpClient` extende `AccessHttpClient` de `@cordele/shared/access-http-base`; todos os requests carregam `X-Empresa-Id` automaticamente.
- `ImportFacade` com testes unitários (cobertura: submit, uploadProgress, erro, takeUntilDestroyed).
- `ReviewFacade` completa: `ignoreFragment(id)` com rollback otimístico, `confirmStructure()` que emite navegação para COMP, `loadStructure(manuscritoId)`.
- `ManuscritoHttpAdapter.ignoreFragment(id)` e `ManuscritoHttpAdapter.confirmStructure(manuscritoId)` (endpoints M4: `PATCH /api/imp/manuscripts/:id/fragments/:fragId/ignore` e `POST /api/imp/manuscripts/:id/confirm`).
- DTOs: `ManuscritoHistoryDto`, `ProjetoManuscritosDto`.
- `npx nx test imp-data-access` PASS.

#### Correcoes mandatorias

1. Criar `frontend/libs/imp/data-access/src/lib/imp-http-client.ts`:
```typescript
// ImpHttpClient — usa AccessHttpClient de @cordele/shared/access-http-base
// NÃO usa HttpClient diretamente; X-Empresa-Id é adicionado automaticamente
import { Injectable, inject } from '@angular/core';
import { AccessHttpClient } from '@cordele/shared/access-http-base';

@Injectable({ providedIn: 'root' })
export class ImpHttpClient extends AccessHttpClient {}
```

2. Substituir injeção de `HttpClient` em `ManuscritoHttpAdapter` e `SegmentoCuradoriaHttpAdapter` por `ImpHttpClient`.

3. Implementar em `ManuscritoHttpAdapter`:
   - `ignoreFragment(manuscritoId: string, fragmentId: string): Observable<void>` → `PATCH /api/imp/manuscripts/{manuscritoId}/fragments/{fragmentId}/ignore`
   - `confirmStructure(manuscritoId: string): Observable<ConfirmResponseDto>` → `POST /api/imp/manuscripts/{manuscritoId}/confirm`

4. Completar `ReviewFacade` em `frontend/libs/imp/data-access/src/lib/review.facade.ts`:
   - Signals: `estrutura = signal<ContentTree | null>(null)`, `phase = signal<'idle' | 'loading' | 'confirming' | 'error'>('idle')`, `errorMessage = signal<string | null>(null)`
   - `loadStructure(manuscritoId: string)`: GET via ManuscritoPort contra o imp-service real; se 404 → emitir `errorMessage` com mensagem localizada; não usar fallback com dados fictícios
   - `ignoreFragment(id: string)`: mutação otimística no signal `estrutura`; em caso de erro do servidor reverte e expõe toast via `errorMessage`
   - `confirmStructure(manuscritoId: string)`: chama confirmStructure no adapter; emite evento de navegação para COMP via `Router.navigate(['/comp', manuscritoId])`

5. Implementar testes em `frontend/libs/imp/data-access/src/lib/import.facade.spec.ts` e `review.facade.spec.ts` (vitest + TestBed):
   - ImportFacade: estado idle→uploading→done; estado erro; reset(); takeUntilDestroyed (cancelamento)
   - ReviewFacade: loadStructure hidrata signal; ignoreFragment rollback em 500; confirmStructure navega para /comp/:id

#### Arquivos-alvo
- `frontend/libs/imp/data-access/src/lib/imp-http-client.ts` (novo)
- `frontend/libs/imp/data-access/src/lib/adapters/manuscrito-http.adapter.ts` (atualizar: ImpHttpClient + M4 endpoints)
- `frontend/libs/imp/data-access/src/lib/adapters/segmento-curadoria-http.adapter.ts` (atualizar: ImpHttpClient)
- `frontend/libs/imp/data-access/src/lib/import.facade.ts` (adicionar testes: `import.facade.spec.ts`)
- `frontend/libs/imp/data-access/src/lib/review.facade.ts` (completar: signals + ignore + confirm + rollback)
- `frontend/libs/imp/data-access/src/lib/models/imp.models.ts` (adicionar: ManuscritoHistoryDto, ConfirmResponseDto, tipos M4)
- `frontend/libs/imp/data-access/src/index.ts` (re-exports)
- `frontend/libs/imp/data-access/src/lib/import.facade.spec.ts` (novo)
- `frontend/libs/imp/data-access/src/lib/review.facade.spec.ts` (novo)

#### Contrato de tipo
```typescript
// imp.models.ts — tipos obrigatórios desta fase
export interface ManuscritoHistoryDto {
  manuscritoId: string;
  projetoId: string;
  createdAt: string; // ISO-8601
  status: 'importado' | 'confirmado' | 'descartado';
}

export interface ConfirmResponseDto {
  manuscritoId: string;
  compJobId: string; // ID do job COMP para navegação
}

export interface FragmentIgnoreDto {
  fragmentId: string;
  ignored: boolean;
}

// ReviewFacade — signals públicos (asReadonly())
estrutura: Signal<ContentTree | null>;
phase: Signal<'idle' | 'loading' | 'confirming' | 'error'>;
errorMessage: Signal<string | null>;
```

#### Sequencia de execucao
1. `imp-http-client.ts` + substituir HttpClient nos adapters
2. Addendum M4: métodos `ignoreFragment` e `confirmStructure` em `ManuscritoHttpAdapter`
3. Completar `ReviewFacade` com signals e rollback
4. Testes: `import.facade.spec.ts` e `review.facade.spec.ts`
5. Atualizar `index.ts` com re-exports públicos

#### Multi-empresa
`ImpHttpClient extends AccessHttpClient` de `@cordele/shared/access-http-base`. Este é o wiring de INT-FE-IMP-001. Nenhum `HttpClient` nu pode permanecer em `imp-data-access`.

#### Criterios de aceite
```bash
npx nx test imp-data-access         # PASS (import.facade.spec.ts + review.facade.spec.ts)
npx nx lint imp-data-access         # PASS
npx nx build imp-data-access        # PASS
```
Verificação manual: `ImpHttpClient` estende `AccessHttpClient` (sem `HttpClient` nu em adapters).

#### Riscos
- Addendum M4: o BE do imp-service está disponível. Se `PATCH /api/imp/manuscripts/:id/fragments/:fragId/ignore` ou `POST /api/imp/manuscripts/:id/confirm` retornarem 404 ou 405 na integração, isso é BLOQUEADOR DE BACKEND — sinalizar ao coordenador antes de continuar P3. Não usar mock adapter para contornar: a integração deve ser real.
- Rollback otimístico: a mutação do signal `estrutura` deve copiar imutavelmente o array de blocos (spread operator); mutação direta quebraria o OnPush detection.

#### Instrucao para implementador
O BE do imp-service está disponível e deve ser usado diretamente. Criar `ImpHttpClient` primeiro, substituir injeção nos dois adapters. Implementar os endpoints M4 no HTTP adapter contra o imp-service real (verificar `backend/services/imp-service/contracts/api-contract.md` para paths exatos). Completar `ReviewFacade` com os tipos exatos do contrato acima. Escrever testes para os dois facades usando `HttpClientTestingModule` (TestBed) — não usar `ManuscritoMockAdapter` em testes de facade, apenas `HttpTestingController`. Se qualquer endpoint M4 retornar 404/405 em ambiente de dev, PARAR e reportar como BLOQUEADOR DE BACKEND antes de avançar para P3.

---

### Prioridade 3 — Shell Entry + Bootstrap

**Status:** pendente
**Issues cobertas:** FE-IMP-001, FE-IMP-002, FE-IMP-003, FE-IMP-004, FE-IMP-005
**Categoria:** WIRING

#### Objetivo
Criar o contrato público do módulo IMP em `imp-shell-entry`: `ImpContract`, `IMP_PERMISSION_MAP`, `IMP_FEATURE_FLAGS`, `IMP_MODULE_DESCRIPTOR`, e registrar o módulo no shell de `cordele-web`.

#### Problema
`libs/imp/shell-entry/src/lib/` vazio após scaffold. Módulo IMP não aparece no menu nem nas rotas de `cordele-web`. Shell de `apps/cordele-web/src/app/shell.config.ts` não carrega o módulo IMP. Sem esse registro, as telas T03/T04 não são acessíveis.

#### Resultado esperado
- `libs/imp/shell-entry/src/lib/imp.contract.ts` — interface `ImpContract` com `routes`, `permissions`, `featureFlags`.
- `libs/imp/shell-entry/src/lib/imp.permission-map.ts` — `IMP_PERMISSION_MAP`: `imp.import`, `imp.review`, `imp.confirm`.
- `libs/imp/shell-entry/src/lib/imp.feature-flags.ts` — `IMP_FEATURE_FLAGS`: `imp.reimport` (on), `imp.ignoreFragment` (on), `imp.existingProject` (on).
- `libs/imp/shell-entry/src/lib/imp.module-descriptor.ts` — `IMP_MODULE_DESCRIPTOR` com `route: '/imp'`, `menuLabel: 'Importação'`, `icon: 'upload'`.
- `libs/imp/shell-entry/src/lib/imp.routes.ts` — rotas lazy-loaded: `/imp/upload`, `/imp/projetos/:projetoId/importar`, `/imp/manuscritos/:manuscritoId/revisao`.
- `apps/cordele-web/src/app/shell.config.ts` — importar e registrar `IMP_MODULE_DESCRIPTOR`; adicionar entrada na rota lazy no `app.routes.ts`.
- `npx nx lint imp-shell-entry` PASS; `npx nx build imp-shell-entry` PASS.

#### Correcoes mandatorias

1. Criar `frontend/libs/imp/shell-entry/src/lib/imp.contract.ts`:
```typescript
export interface ImpContract {
  routes: Routes;
  permissions: readonly ['imp.import', 'imp.review', 'imp.confirm'];
  featureFlags: readonly ['imp.reimport', 'imp.ignoreFragment', 'imp.existingProject'];
}
```

2. Criar `frontend/libs/imp/shell-entry/src/lib/imp.permission-map.ts`:
```typescript
export const IMP_PERMISSION_MAP = {
  import: 'imp.import',
  review: 'imp.review',
  confirm: 'imp.confirm',
} as const;
```

3. Criar `frontend/libs/imp/shell-entry/src/lib/imp.feature-flags.ts`:
```typescript
export const IMP_FEATURE_FLAGS = {
  reimport: { key: 'imp.reimport', default: true },
  ignoreFragment: { key: 'imp.ignoreFragment', default: true },
  existingProject: { key: 'imp.existingProject', default: true },
} as const;
```

4. Criar `frontend/libs/imp/shell-entry/src/lib/imp.module-descriptor.ts`:
```typescript
export const IMP_MODULE_DESCRIPTOR = {
  route: '/imp',
  menuLabel: 'Importação',
  icon: 'upload',
  lazyLoad: () => import('@cordele/imp/feature-upload').then(m => m.ImpRoutes),
} as const;
```

5. Criar `frontend/libs/imp/shell-entry/src/lib/imp.routes.ts`:
```typescript
export const IMP_ROUTES: Routes = [
  { path: 'upload', component: UploadComponent, canActivate: [authGuard, empresaGuard, accessGuard('imp.import')] },
  { path: 'projetos/:projetoId/importar', component: UploadComponent, canActivate: [authGuard, empresaGuard, impProjetoGuard, accessGuard('imp.import')] },
  { path: 'manuscritos/:manuscritoId/revisao', component: RevisaoDeEstruturaComponent, canActivate: [authGuard, empresaGuard, accessGuard('imp.review')] },
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
];
```

6. Em `apps/cordele-web/src/app/app.routes.ts`: adicionar entrada lazy:
```typescript
{ path: 'imp', loadChildren: () => import('@cordele/imp/shell-entry').then(m => m.IMP_ROUTES) }
```

#### Arquivos-alvo
- `frontend/libs/imp/shell-entry/src/lib/imp.contract.ts` (novo)
- `frontend/libs/imp/shell-entry/src/lib/imp.permission-map.ts` (novo)
- `frontend/libs/imp/shell-entry/src/lib/imp.feature-flags.ts` (novo)
- `frontend/libs/imp/shell-entry/src/lib/imp.module-descriptor.ts` (novo)
- `frontend/libs/imp/shell-entry/src/lib/imp.routes.ts` (novo — completo com guards)
- `frontend/libs/imp/shell-entry/src/index.ts` (re-exports dos 5 artefatos)
- `frontend/apps/cordele-web/src/app/app.routes.ts` (adicionar rota lazy para `/imp`)
- `frontend/apps/cordele-web/src/app/shell.config.ts` (registrar IMP_MODULE_DESCRIPTOR)

#### Sequencia de execucao
1. Contrato + permission-map + feature-flags (sem dependências externas)
2. Rotas lazy (depende de feature-upload e feature-review libs existirem — do P1)
3. Module descriptor
4. Registro no shell (app.routes.ts + shell.config.ts)

#### Multi-empresa
Guards `authGuard` e `empresaGuard` são de `@cordele/shared/access-decision`; `accessGuard` idem. Não criar implementações próprias — apenas importar dos shared.

#### Criterios de aceite
```bash
npx nx lint imp-shell-entry         # PASS
npx nx build imp-shell-entry        # PASS
npx nx build cordele-web            # PASS (rota /imp lazy-loaded)
```
Verificação: navegar para `/imp/upload` no dev server não resulta em 404.

#### Riscos
- Os guards `authGuard`, `empresaGuard`, `accessGuard` de `@cordele/shared/access-decision` podem não existir ainda (dependência de outra lib shared). Solução: substituir por `() => true` com comentário `// TODO[INT]: substituir por shared guard quando disponível` — não usar guard stub sem comentário rastreável.

---

### Prioridade 4 — Feature Libs (Upload + Review)

**Status:** pendente
**Issues cobertas:** FE-IMP-012, FE-IMP-013, FE-IMP-014, FE-IMP-015, FE-IMP-016, FE-IMP-017, FE-IMP-018, FE-IMP-022, INT-FE-IMP-003
**Categoria:** FUNCIONAL

#### Objetivo
Implementar a hierarquia de componentes completa de T03 (Upload) e T04 (Revisão de Estrutura) conforme SPEC-02, com testes unitários, skeleton states, e handoff confirm → COMP.

#### Problema
- `UploadComponent` existe mas sem sub-componentes presentacionais (`ManuscriptDropZoneComponent`, `UploadProgressCardComponent`, `ProjectNameFieldComponent`, `ImportSubmitButtonComponent`).
- `RevisaoDeEstruturaComponent` é rascunho sem hierarquia de componentes, sem ReviewFacade wired, sem skeleton states.
- Confirm → COMP handoff (INT-FE-IMP-003) não implementado.
- StepBarComponent (FE-IMP-018) pertence a `imp-navigation` mas é consumido aqui — coordenar.

#### Resultado esperado
- `imp-feature-upload`: `UploadComponent` (smart) + 4 presentacionais + testes (`npx nx test imp-feature-upload` PASS).
- `imp-feature-review`: `RevisaoDeEstruturaComponent` (smart) + hierarquia de componentes + skeleton states (`ContentTreeSkeletonComponent`) + testes.
- `ReviewFacade.confirmStructure()` navega para `/comp/{compJobId}` (INT-FE-IMP-003).
- Verificação de tokens CSS: todos os tokens usados pelos componentes existem em `frontend/apps/cordele-web/src/styles/theme.css`.

#### Correcoes mandatorias

**imp-feature-upload:**
1. Criar em `frontend/libs/imp/feature-upload/src/lib/`:
   - `project-name-field/project-name-field.component.ts` — input signal `value`, output `valueChange`; validação `required`, `minlength=3`.
   - `manuscript-drop-zone/manuscript-drop-zone.component.ts` — drag-and-drop + click; outputs `fileSelected(File)`, `validationError(string)`.
   - `upload-progress-card/upload-progress-card.component.ts` — inputs `phase`, `progressPct`, `fileName`, `errorMessage`; output `retry`.
   - `import-submit-button/import-submit-button.component.ts` — inputs `disabled`, `busy`; output `submit`.
2. Conectar UploadComponent a ImportFacade (signals já existentes); navegar para `/imp/manuscritos/{manuscritoId}/revisao` no estado `done`.
3. Testes: `upload.component.spec.ts` — submit válido → ImportFacade.submit(); estado erro → UploadProgressCard mostra retry; reset().

**imp-feature-review:**
1. Criar em `frontend/libs/imp/feature-review/src/lib/`:
   - `content-block/content-block.component.ts` — input `block: Block`; output `ignore(fragmentId)`.
   - `content-tree/content-tree.component.ts` — input `tree: ContentTree | null`; output `ignore(fragmentId)`.
   - `content-tree-skeleton/content-tree-skeleton.component.ts` — presentacional (skeleton loading state, FE-IMP-022).
   - `action-bar/action-bar.component.ts` — inputs `canConfirm: boolean`, `canIgnore: boolean`; outputs `confirm()`, `cancelIgnore()`.
2. Wiring com ReviewFacade: `loadStructure(manuscritoId)` no `ngOnInit`; `ignoreFragment(id)` via output do `ContentTreeComponent`; `confirmStructure(manuscritoId)` via output do `ActionBarComponent`.
3. Testes: `revisao-de-estrutura.component.spec.ts` — loadStructure chamado no init; ignore → ReviewFacade.ignoreFragment(); confirm → ReviewFacade.confirmStructure(); skeleton visível quando `phase === 'loading'`.

**INT-FE-IMP-003 (confirm → COMP):**
`ReviewFacade.confirmStructure()` deve navegar para `/comp/{compJobId}` usando `Router.navigate`. `compJobId` vem de `ConfirmResponseDto.compJobId` (definido em P2). Se COMP não estiver registrado no shell, usar fallback `/proj/biblioteca` com toast de aviso.

#### Arquivos-alvo
- `frontend/libs/imp/feature-upload/src/lib/project-name-field/` (novo)
- `frontend/libs/imp/feature-upload/src/lib/manuscript-drop-zone/` (novo)
- `frontend/libs/imp/feature-upload/src/lib/upload-progress-card/` (novo)
- `frontend/libs/imp/feature-upload/src/lib/import-submit-button/` (novo)
- `frontend/libs/imp/feature-upload/src/lib/upload/upload.component.ts` (atualizar: conectar sub-componentes)
- `frontend/libs/imp/feature-upload/src/lib/upload/upload.component.spec.ts` (novo)
- `frontend/libs/imp/feature-review/src/lib/content-block/` (novo)
- `frontend/libs/imp/feature-review/src/lib/content-tree/` (novo)
- `frontend/libs/imp/feature-review/src/lib/content-tree-skeleton/` (novo — FE-IMP-022)
- `frontend/libs/imp/feature-review/src/lib/action-bar/` (novo)
- `frontend/libs/imp/feature-review/src/lib/revisao-de-estrutura/revisao-de-estrutura.component.ts` (completar)
- `frontend/libs/imp/feature-review/src/lib/revisao-de-estrutura/revisao-de-estrutura.component.spec.ts` (novo)

#### Multi-empresa
Nenhum HTTP direto nestas libs. O cancelamento de upload on `empresaChanged` é responsabilidade do `ImpShellIntegrationService` (P5) que sinaliza à `ImportFacade`.

#### Criterios de aceite
```bash
npx nx test imp-feature-upload      # PASS
npx nx test imp-feature-review      # PASS
npx nx lint imp-feature-upload      # PASS
npx nx lint imp-feature-review      # PASS
npx nx build imp-feature-upload     # PASS
npx nx build imp-feature-review     # PASS
```

#### Riscos
- Tokens CSS do protótipo: verificar que classes como `drop-zone`, `upload-card`, etc. existem em `theme.css`. Se ausentes: declarar CSS próprio em `.component.scss` usando variáveis CSS do design system (`--color-primary`, etc.).
- `StepBarComponent` (FE-IMP-018) pertence a `imp-navigation` (P5) mas é consumido pelo `UploadComponent`. Solução: em P4, usar stub `StepBarComponent` (`@Input() steps`, `@Input() activeIndex`; template: `<div class="step-bar-stub"></div>`) dentro de `imp-feature-upload`; substituir pelo real em P5.

---

### Prioridade 5 — Guards + Navegacao + Integration

**Status:** pendente
**Issues cobertas:** FE-IMP-019, FE-IMP-020, INT-FE-IMP-004, INT-FE-IMP-005, INT-FE-IMP-006
**Categoria:** WIRING

#### Objetivo
Implementar `impProjetoGuard` em `imp-access`, `StepBarComponent` e `BreadcrumbDynamic` em `imp-navigation`, e `ImpShellIntegrationService` em `imp-integration` (bridges: EmpresaContext, NavigationService, telemetria).

#### Correcoes mandatorias

**imp-access (FE-IMP-019):**
Criar `frontend/libs/imp/access/src/lib/guards/imp-projeto.guard.ts`:
```typescript
export const impProjetoGuard: CanActivateFn = (route) => {
  const projetoId = route.paramMap.get('projetoId') ?? '';
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_V4.test(projetoId)) {
    return inject(Router).createUrlTree(['/projetos']);
  }
  return true;
};
```
Testes: UUID v4 válido → true; string qualquer → UrlTree `/projetos`; UUID v3/v5 → UrlTree.

**imp-navigation (FE-IMP-018, FE-IMP-020):**
- `StepBarComponent`: standalone, OnPush; `@Input() steps: string[]`, `@Input() activeIndex: number`. Substituir o stub de P4 por este componente real.
- `BreadcrumbDynamicComponent`: standalone, OnPush; `@Input() crumbs: { label: string; route: string }[]`. Registrado em rotas T03/T04 via `NavigationService` de `@cordele/shared/access-decision`.

**imp-integration (INT-FE-IMP-005, INT-FE-IMP-006):**
Criar `frontend/libs/imp/integration/src/lib/imp-shell-integration.service.ts`:
- `init()`: registra contribuições de navegação IMP no `NavigationService`.
- Subscreve `EmpresaContext` de `@cordele/shared/empresa-context`; expõe signal `empresaChanged`.
- `ImportFacade` usa `effect(() => { if (empresaChanged()) { this.reset(); } })` para cancelar upload in-flight.
- Publica breadcrumbs de lifecycle: `import:started`, `import:succeeded`, `import:failed` via correlation id do interceptor `access-http-base`.

**INT-FE-IMP-004:** Registrar `accessGuard('imp.import')` e `accessGuard('imp.review')` de `@cordele/shared/access-decision` nas rotas (substituir stubs de P3).

#### Arquivos-alvo
- `frontend/libs/imp/access/src/lib/guards/imp-projeto.guard.ts` (novo)
- `frontend/libs/imp/access/src/lib/guards/imp-projeto.guard.spec.ts` (novo)
- `frontend/libs/imp/access/src/index.ts` (re-export)
- `frontend/libs/imp/navigation/src/lib/step-bar/step-bar.component.ts` (novo — substitui stub de P4)
- `frontend/libs/imp/navigation/src/lib/breadcrumb-dynamic/breadcrumb-dynamic.component.ts` (novo)
- `frontend/libs/imp/navigation/src/index.ts` (re-export)
- `frontend/libs/imp/integration/src/lib/imp-shell-integration.service.ts` (novo)
- `frontend/libs/imp/integration/src/lib/imp-shell-integration.service.spec.ts` (novo)
- `frontend/libs/imp/integration/src/index.ts` (re-export)
- `frontend/libs/imp/shell-entry/src/lib/imp.routes.ts` (atualizar: substituir guard stubs por reais)

#### Multi-empresa
`ImpShellIntegrationService` consome `EmpresaContext` de `@cordele/shared/empresa-context` (não usa `HttpClient`). `ImportFacade` reage via `effect()` ao signal `empresaChanged` do integration service — cancela upload com `takeUntilDestroyed`.

#### Criterios de aceite
```bash
npx nx test imp-access              # PASS (guard UUID v4 + redirect)
npx nx test imp-integration         # PASS (init registers nav; empresaChanged cancels upload)
npx nx lint imp-access              # PASS
npx nx lint imp-navigation          # PASS
npx nx lint imp-integration         # PASS
npx nx build imp-access             # PASS
npx nx build imp-navigation         # PASS
npx nx build imp-integration        # PASS
```

---

### Prioridade 6 — UX Polish + Observabilidade

**Status:** pendente
**Issues cobertas:** FE-IMP-021, FE-IMP-023
**Categoria:** FUNCIONAL

#### Objetivo
Implementar error mapper (traduz `ErroDetail` da API para mensagens UI amigáveis) e telemetria de lifecycle events.

#### Correcoes mandatorias

**FE-IMP-021 — Error mapper:**
Criar `frontend/libs/imp/data-access/src/lib/imp-error-mapper.ts`:
- `mapImpError(err: HttpErrorResponse): string` — traduz:
  - 422 `imp-invalid-binding` → `"Informe o nome do projeto ou selecione um existente, mas não ambos."`
  - 413 → `"Arquivo muito grande. Limite: 50 MB."`
  - 415 → `"Formato não suportado. Envie .docx ou .md."`
  - 504 → `"Tempo limite excedido. Tente novamente."`
  - fallback → `"Erro inesperado. Tente novamente."`
- `ImportFacade.submit()` usa `mapImpError` ao setar `errorMessage`.

**FE-IMP-023 — Telemetria:**
`ImpShellIntegrationService.init()` (já criado em P5) passa a emitir eventos via `pipeline_events` (ou equivalente Angular de observabilidade):
- `import:started` — no `ImportFacade.submit()` início
- `import:succeeded` — no estado `done`
- `import:failed` — no estado `error`
- `review:confirmed` — no `ReviewFacade.confirmStructure()` conclusão
Carrier de correlation id: header `X-Correlation-Id` já adicionado pelo `access-http-base` interceptor.

#### Arquivos-alvo
- `frontend/libs/imp/data-access/src/lib/imp-error-mapper.ts` (novo)
- `frontend/libs/imp/data-access/src/lib/imp-error-mapper.spec.ts` (novo)
- `frontend/libs/imp/data-access/src/lib/import.facade.ts` (atualizar: usar mapImpError)
- `frontend/libs/imp/integration/src/lib/imp-shell-integration.service.ts` (atualizar: emitir telemetria events)

#### Criterios de aceite
```bash
npx nx test imp-data-access         # PASS (error mapper: 5 casos)
npx nx lint imp-data-access         # PASS
npx nx build imp-data-access        # PASS
```

---

### Prioridade 7 — E2E Playwright

**Status:** pendente
**Issues cobertas:** FE-IMP-024, FE-IMP-025
**Categoria:** VALIDACAO

#### Objetivo
Criar o projeto Playwright `apps/imp-e2e`, implementar os 18 cenários BDD de T03/T04 definidos nas EARS da SPEC-04, incluindo rollback de ignore e confirm → COMP handoff.

#### Correcoes mandatorias

1. Criar projeto Playwright:
```
npx nx g @nx/playwright:configuration --project=imp-e2e
```
OU criar manualmente `frontend/apps/imp-e2e/` com `project.json` (tag `scope:imp, type:e2e`) e `playwright.config.ts`.

2. Implementar specs em `frontend/apps/imp-e2e/src/`:
   - `t03-upload.spec.ts`: upload válido (.docx) → navega para /revisao; upload sem arquivo → erro client-side; upload timeout → estado error + retry; upload com projetoId malformado → guard redireciona.
   - `t04-review.spec.ts`: deep-link revisao → single GET (sem polling); ignore fragment → rollback em 500; confirm → navega para /comp/:compJobId; empresa muda durante upload → cancelado.

3. **Pitfall obrigatório (learning-context):** usar `test.fixme('TODO[FE-IMP-025]: implementar quando COMP estiver disponível')` para cenários dependentes de COMP, **não** `await expect(page).toHaveURL(/.*/)` sob `test.skip()`.

#### Arquivos-alvo
- `frontend/apps/imp-e2e/` (diretório novo)
- `frontend/apps/imp-e2e/project.json`
- `frontend/apps/imp-e2e/playwright.config.ts`
- `frontend/apps/imp-e2e/src/t03-upload.spec.ts`
- `frontend/apps/imp-e2e/src/t04-review.spec.ts`

#### Criterios de aceite
```bash
npx nx e2e imp-e2e                  # PASS (cenários T03 + T04 sem fixme; fixme mostram como pending, não verde)
npx nx lint imp-e2e                 # PASS
```
Verificação: nenhum `test.skip()` com asserção vácua (`/.*/ `). Cenários sem COMP usam `test.fixme()`.

#### Riscos
- COMP pode não estar disponível no momento do e2e. Usar `test.fixme()` para esses cenários até COMP ser registrado no shell.
- `apps/imp-e2e` depende do dev server estar rodando. Verificar `baseURL` no `playwright.config.ts`.

---

## §4 Dependencias externas

| Dependência | Tipo | Bloqueia | Estado |
|---|---|---|---|
| `@cordele/shared/access-http-base` | Lib Angular shared | P2 (ImpHttpClient) | Assumido disponível; verificar em `frontend/libs/shared/access-http-base/` |
| `@cordele/shared/empresa-context` | Lib Angular shared | P5 (ImpShellIntegrationService) | Assumido disponível |
| `@cordele/shared/access-decision` | Lib Angular shared (authGuard, empresaGuard, accessGuard) | P3, P5 | Assumido disponível |
| BE `PATCH /api/imp/manuscripts/:id/fragments/:fragId/ignore` | Endpoint M4 | P2 (ReviewFacade) | BE disponível; verificar path exato em `backend/services/imp-service/contracts/api-contract.md`; se ausente — BLOQUEADOR DE BACKEND |
| BE `POST /api/imp/manuscripts/:id/confirm` | Endpoint M4 | P2 (ReviewFacade) | Idem |
| Módulo COMP registrado no shell | Rota de destino do confirm | P7 (e2e) | Incerto; usar `test.fixme()` para cenários dependentes |

---

## §5 Restricoes arquiteturais

| Regra | Descrição | Verificação |
|---|---|---|
| RULE-NX-01 | `scope:imp` não importa `scope:comp`, `scope:pub`, `scope:proj` | `npx nx lint` |
| RULE-NX-02 | `type:feature` não importa outro `type:feature` | `npx nx lint` (boundary rule) |
| RULE-NX-03 | Shared libs acessadas apenas via `@cordele/shared/*` | `npx nx lint` |
| RULE-NX-04 | `type:data-access` não importa `type:feature` | `npx nx lint` |
| RULE-NX-05 | Sem `HttpClient` nu em nenhuma lib IMP — usar `ImpHttpClient extends AccessHttpClient` | Code review P2 |
| RULE-NX-06 | Signals como API pública das facades (`.asReadonly()`) | Code review P2 |
| RULE-NX-07 | `type:app` (`shell-entry`) pode importar tudo de `scope:imp` | Permitido explicitamente |

---

## §6 Referencias

- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/generator-config.yml` — definição das 8 sublibs, guards, permissões, feature flags
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` — hierarquia UploadComponent e RevisaoDeEstruturaComponent
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` — EARS (critérios comportamentais)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` — ImpShellIntegrationService
- `docs/architecture/frontend/modules/imp/frontend/module-state.md` — estado baseline 2026-08-31
- `docs/architecture/shared/multi-empresa.md` — EmpresaContextHolder, propagação, interceptor
- `docs/architecture/frontend/standards/nx-boundaries.md` — tax-map, allowed directions, tags
- `docs/architecture/frontend/standards/access-layer-contracts.md` — AuthSession, EmpresaContext, AccessDecision
