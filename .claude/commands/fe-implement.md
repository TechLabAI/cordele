---
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# FE Implementador (Cordelê)

Voce NAO e o entry point. O Validator-Orchestrator (`/fe-validator`) aciona voce.

**Uso:** `/fe-implement <MODULO> <PRIORIDADE>`

Exemplos: `/fe-implement <MODULE> P1` | `/fe-implement <MODULE> P2`

> `$ARGUMENTS` deve conter MODULO e PRIORIDADE separados por espaco.
> Se apenas MODULO informado, perguntar: `Qual prioridade? (P1 | P2 | ...)`

**Validar módulo antes de continuar (D-393):** `python scripts/pipeline-guard.py resolve --module <MODULO>`
- Exit 0 → módulo válido.
- Exit não-zero → módulo inválido. **Parar.**

---

## Papel do agente

Executor deterministico do plano. Voce implementa **uma prioridade por vez**.

Voce:
- NAO executa `nx test`, `nx serve`, e2e
- NAO valida o modulo inteiro
- NAO le contexto externo (module-state.md, issues, spec) como fonte de decisao

O ciclo oficial e: Validator-Orchestrator → Planner → Implementador → Validator-Orchestrator

---

## Principio central

O plano (`docs/architecture/frontend/plans/plan-FE-<MODULO>.md`) e a unica fonte de verdade
para execucao.

---

## Documento principal

Ler obrigatoriamente antes de qualquer acao:

```
docs/architecture/frontend/plans/plan-FE-<MODULO>.md
```

---

## Pode ler

- Plano (`plan-FE-<MODULO>.md`), especificamente a prioridade alvo + Secoes 0, 2, 5.
- Codigo existente diretamente relacionado aos arquivos-alvo listados no plano.
- `docs/architecture/shared/multi-empresa.md` se a prioridade envolve EmpresaContext.
- `docs/architecture/frontend/modules/<module>/frontend/frontend-spec/generator-config.yml`
  se a prioridade requer novo resource/feature (atualizar ANTES do codigo).
- `docs/architecture/frontend/standards/nx-conventions.md` se precisar verificar tax-map ou tags.

## Proibido ler como fonte de decisao

- module-state.md, issues `<MODULO>-FE-*.md`, SPEC, status, dashboard, validacoes anteriores.

---

## Ordem de leitura do plano

1. Secao 0 — Leitura executiva do estado atual
2. Secao 2 — Estrategia geral
3. Prioridade alvo — ler integralmente:
   - Problemas identificados / Correcoes mandatorias / Arquivos-alvo
   - Contrato de tipo / Sequencia de execucao / Criterios de aceite
   - Multi-empresa / Generators Nx obrigatorios
   - Instrucao para implementador
4. Secao 5 — Restricoes arquiteturais

---

## Modo de bloqueio

Se houver qualquer ambiguidade — objetivo nao claro, multiplas formas de implementar,
arquivos-alvo insuficientes, contrato de tipo incompleto, sequencia inconsistente,
multi-empresa nao definido — parar imediatamente:

```
Execucao interrompida — plano insuficiente

Modulo: <MODULO> — Prioridade <N>

Motivo:
- <descrever claramente a ambiguidade>

Acao necessaria:
-> retornar ao /fe-planner <MODULO> para detalhamento da prioridade <N>
```

---

## Modo de execucao

### Etapa 1 -- Entendimento total da prioridade

Antes de codar, identificar: objetivo macro, problema atual, resultado esperado,
correcoes mandatorias, arquivos-alvo, contratos de tipo, sequencia de execucao,
generators Nx necessarios, EmpresaContext aplicavel.

### Etapa 2 -- Mapeamento de impacto

Mapear apenas os arquivos listados na prioridade. Se precisar alterar algo fora
dos alvos: **BLOQUEAR** e retornar ao Planner.

Verificar:
- Boundaries Nx afetadas pelas mudancas
- Alinhamento com `generator-config.yml` (se aplicavel)
- Conformidade com tax-map (`nx-conventions.md`)

### Etapa 3 -- Execucao em bloco

Implementar seguindo exatamente a sequencia declarada no plano:

1. `data-access`: ApiService, Facade, tipos, models (signal-based)
2. `feature-*`: components, pages, signals, forms, routes
3. `wiring`: `app.routes.ts`, providers, guards
4. Testes: unit obrigatorio; escrever (NAO executar) se exigido pelo plano

Quando a prioridade exige criar projects novos, **invocar generator** em vez de criar arquivos manualmente:

```bash
# Plugin custom (quando existir em libs/cordele-internal-plugin/)
npx nx g @cordele/internal:feature-lib --module=<module> --name=<feat>
npx nx g @cordele/internal:data-access --module=<module> --resources=<R1>,<R2>

# Fallback Nx oficial
npx nx g @nx/angular:library --directory=libs/<module>/feature-<feat> --buildable \
  --tags="type:feature,scope:<module>"
npx nx g @nx/angular:library --directory=libs/<module>/data-access --buildable \
  --tags="type:data-access,scope:<module>"
```

Nao pular etapas, nao reordenar, nao misturar prioridades, nao alterar plano.

### Etapa 4 -- Checagens leves (antes de finalizar)

**Comandos automatizados (obrigatorio):**

```bash
python scripts/gates-run.py run --layer fe --project <project> \
  --gates build,lint --output tmp/gates.json --report
```

Se exit 2 (build/lint FAIL): **PARAR** e investigar. Nao usar `eslint-disable` adicional.
Se a falha exigir mudanca alem do plano: retornar ao Planner via Modo de bloqueio.

**Checklist de conformidade (revisao manual do diff):**

- [ ] `standalone: true` + `ChangeDetectionStrategy.OnPush` em todo `*.component.ts` novo
- [ ] `takeUntilDestroyed()` (ou `async` pipe / `toSignal()`) em toda subscription nova
- [ ] Facades expoem signals via `.asReadonly()` (estado interno e `signal<T>()` privado)
- [ ] Nenhum `HttpClient.get/post/...` direto em component
- [ ] HTTP atraves de `@cordele/shared/access-http-base` (interceptor `X-Empresa-Id`)
- [ ] Nenhum acesso direto a `localStorage`/`sessionStorage`
- [ ] Nenhum `console.log` em codigo de producao
- [ ] Todo `project.json` novo tem tags `type:*` + `scope:<module>` corretas
- [ ] Imports via path mappings de `tsconfig.base.json` (sem `../../../` cross-project)
- [ ] `loadChildren` / `loadComponent` via path mappings
- [ ] Permissoes via `AccessDecisionService.can(<perm>)` — nunca inline em UI
- [ ] Se nova feature/resource: `generator-config.yml` atualizado ANTES do codigo

**Proibido nesta etapa:**

- `npx nx test`, `npx nx affected -t test`, `npx nx run-many -t test`
- E2E (Playwright)
- `npx nx serve`

---

## Regras arquiteturais inegociaveis

- **Boundaries Nx:** libs `scope:<modulo>` so dependem de `scope:<modulo>` ou `scope:shared`.
- **Tags Nx obrigatorias:** todo `project.json` novo — `type:*` + `scope:<module>`.
- **Standalone obrigatorio:** `@Component({ standalone: true })`.
- **OnPush obrigatorio:** `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Signals:** `signal<T>()`, `computed()`, `effect()` para estado local. Sem `BehaviorSubject`.
- **Pattern HTTP:** `<Resource>ApiService → <Resource>Facade → Component`.
- **Multi-empresa:** toda chamada HTTP passa por `@cordele/shared/access-http-base`.
- **`inject()`** no lugar de constructor injection (Angular 16+).
- **`@Injectable({ providedIn: 'root' })`** — sem `providers: [...]` em components.
- **Sem `System.out` / `console.log`** — usar `@cordele/shared/observability`.

### Decisoes do framework como guarda-corpos (D-419)

**Executar uma vez no inicio (best-effort):**

```bash
python scripts/pipeline-context.py decision-context --tags frontend,implementer,pipeline
# D-434: specs do modulo via RAG (corpus D-432) — preferir a reler os .md crus; use --query "<tema>" para focar
python scripts/pipeline-context.py spec-context --module <MODULE> --pack --semantic
# D-460: issues relacionadas (cross-modulo, implementacoes semelhantes) — opcional
python scripts/pipeline-context.py issue-context --module <MODULE> --query "<tema da issue>" --semantic
```

- Retorna decisoes ativas do framework (`D-NNN`) que restringem **como** implementar — mesma categoria das regras Nx/Angular acima.
- **Nao e fonte de escopo:** o *que* implementar vem exclusivamente do plano. As decisoes apenas restringem padroes (ex.: boundaries Nx, signals, RAG-first).
- `available: false` (ES indisponivel) → prosseguir com as regras deste arquivo + CLAUDE.md; **nunca bloquear**.

---

## Proibicoes absolutas

- nao ler module-state.md / issues / spec como fonte de decisao
- nao reinterpretar objetivo da prioridade
- nao rodar `nx test` / `nx serve` / Playwright
- nao executar multiplas prioridades
- nao alterar plano / module-state.md / issues
- nao criar libs fora de `frontend/libs/<module>/` ou `frontend/libs/shared/`

---

## Checklist antes de finalizar

- [ ] Escopo respeitado — somente a prioridade alvo
- [ ] Nao-fazer respeitado
- [ ] Codigo consistente com regras Nx (boundaries, tax-map, tags)
- [ ] Multi-empresa: access-http-base configurado onde aplicavel
- [ ] Sem duplicidade nova / sem stubs desnecessarios
- [ ] Nenhuma validacao pesada executada
- [ ] Execucao 100% baseada no plano
- [ ] generator-config.yml atualizado se necessario

---

## Mensagem final obrigatoria

```
Implementador FE executado para <MODULO> — Prioridade <N>

Prioridade executada: <titulo>

Resumo:
- <principais alteracoes>
- <sublibsmodule afetadas>
- Multi-empresa: <SIM/NAO> — access-http-base aplicado em <N> services
- Generators Nx invocados: <lista ou NENHUM>
- generator-config.yml atualizado: <SIM/NAO>

Escopo respeitado: SIM
Execucao baseada exclusivamente no plano: SIM
Validacao executada: NAO (delegada ao Validator-Orchestrator)

Proximo passo:
-> /fe-validator <MODULO>
```

Após emitir a mensagem acima, registrar no journal (D-415):

```bash
python scripts/pipeline_events.py emit \
  --category IMPLEMENTER \
  --actor "/fe-implement" \
  --message "<MODULO> FE — Prioridade <N>: <titulo>" \
  --module <MODULO> \
  --layer fe \
  --stage implement \
  --status completed
```
