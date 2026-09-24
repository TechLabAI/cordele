---
allowed-tools: Read, Grep, Glob, Bash
---

# FE Validator-Orchestrator (Cordelê)

> **Higiene de contexto (D-463):** execute `/clear` ao iniciar uma nova atividade.
> O contexto vem do RAG (injetado por este command) — não do histórico acumulado.
> Dentro de uma atividade longa, prefira `/compact` em vez de `/clear`.

Voce e o agente central do pipeline IA-First do frontend Cordelê (Angular + Nx).

**Modulo:** `$ARGUMENTS`

Se nao informado, perguntar: `Qual modulo? (IMP | COMP | PUB | PROJ)`

Mapeamento modulo → paths FE:

- IMP = `frontend/libs/imp/` + issues `IMP-FE-*` / `IMP-INT-*`
- COMP = `frontend/libs/comp/` + issues `COMP-FE-*` / `COMP-INT-*`
- PUB = `frontend/libs/pub/` + issues `PUB-FE-*` / `PUB-INT-*`
- PROJ = `frontend/libs/proj/` + issues `PROJ-FE-*` / `PROJ-INT-*`

**Validar módulo antes de continuar (D-393):** `python scripts/pipeline-guard.py resolve --module <MODULO>`
- Exit 0 → módulo válido. Usar JSON retornado.
- Exit não-zero → módulo inválido. **Parar.**

---

## Papel do agente

Combina tres responsabilidades: validacao tecnica, consolidacao de estado, decisao de fluxo.

Voce controla o ciclo entre Planner (estrategia) e Implementador (execucao).

**Voce e o unico ponto de entrada do pipeline FE.**

---

## Principio central (D-422 module-oriented + D-420 RAG-first)

| Modo | Fonte de contexto | module-state.md |
|---|---|---|
| **BASELINE** | código FE (`frontend/apps/`, `frontend/libs/<module>/`) + issues | criado/atualizado pelo agente |
| **DECISAO** | ES `last_validate.details` + `module-state --layer fe` | **proibido ler** |
| **VALIDACAO** | ES `last_validate.details` + `module-state --layer fe` | **write-only** — atualizado (delta) após gates |

---

## Contexto ES (D-417/D-420/D-422)

**Executar sempre antes de iniciar qualquer modo:**

```bash
python scripts/pipeline-context.py module-state --module <MODULO> --layer fe
```

Interpretar por modo:

**BASELINE** (`available: false` ou `events_count == 0`):
- Prosseguir com leitura de código normalmente.

**BASELINE** (`available: true, events_count > 0`):
- `last_implement.message` e `recent_events` pré-populam seções 7/8 do module-state.md.

**DECISAO** (`available: true`):
- `last_validate.details` → estado autoritativo: `score`, `checklist` (done/total/gaps), `gates`, `next_action`.
- `last_implement.message` → confirma o que foi implementado na última rodada.
- **module-state.md: proibido ler.** O ES é a única fonte de estado em DECISAO.

**DECISAO** (`available: false`):
- Ler `module-state.md` (seções 2, 4, 6, 7, 8, 9) para derivar o routing.
- Decidir com base em score + plano existente.

**VALIDACAO** (`available: true`):
- `last_validate.details` → baseline da rodada anterior (score, gaps, gates).
- `last_implement.message` → confirma o que foi implementado.
- **module-state.md: proibido ler para derivar contexto.** Prosseguir diretamente para os gates.

**VALIDACAO** (`available: false`):
- Prosseguir para os gates sem contexto histórico. module-state.md write-only ao final.

---

## Contexto de decisões do framework (D-419)

**Executar uma vez no início (best-effort), em qualquer modo:**

```bash
python scripts/pipeline-context.py decision-context --tags frontend,validator,pipeline
# D-434: specs do modulo via RAG (corpus D-432) — preferir a reler os .md crus; use --query "<tema>" para focar
python scripts/pipeline-context.py spec-context --module <MODULE> --layer fe --pack --semantic
# D-460: issues relacionadas (cross-modulo, implementacoes semelhantes) — opcional
python scripts/pipeline-context.py issue-context --module <MODULE> --query "<tema da issue>" --semantic
# D-611: known pitfalls (rework_pattern) desta camada — consulte ANTES de decidir/rotear
python scripts/pipeline-context.py learning-context --module <MODULE> --layer fe
```

- Retorna as decisões ativas do framework (`D-NNN`) relevantes para este agente — guarda-corpos arquiteturais já decididos.
- Respeitar as decisões listadas ao avaliar maturidade e rotear (ex.: convenções de pipeline FE, RAG-first, padrões Angular/Nx).
- `learning-context` (D-611/D-498/D-497) devolve **known pitfalls** cross-client agrupados por `defect_signature`: se um padrão conhecido explica um gap detectado, cite-o na decisão/README em vez de re-diagnosticar do zero. Não é responsabilidade do validator emitir sinal — isso acontece no `fe-implement` quando o defeito é de fato corrigido.
- `available: false` (ES indisponível) → prosseguir sem o pacote de decisões; **nunca bloquear**.
- Não reler o consolidation doc — o índice ES é a fonte consultável.

---

## Modos de operacao

---

## Modo 1 -- BASELINE

**Quando usar:** module-state.md nao existe, esta inconsistente, ou primeira execucao do modulo FE.

**Acao:**

1. Ler codigo FE do modulo:
   - `frontend/libs/<module>/` — todas as sublibsmodule (feature-*, data-access, ui, access)
   - `frontend/apps/cordele-web/` — routing e providers do modulo
   - Issues ativas: `docs/architecture/frontend/issues/<MODULO>-FE-*.md` + `<MODULO>-INT-*.md`
   - `docs/architecture/frontend/modules/<module>/frontend/frontend-spec/generator-config.yml`
2. Consolidar estado real:
   - Estado de cada sublib (criada, tags Nx corretas, boundaries ok)
   - Estado das issues ativas (DONE / PARTIAL / MISSING por item do checklist)
   - Score de maturidade agregado (0-100, ver rubrica abaixo)
3. Gerar module-state.md usando o scaffold abaixo.

**Regra critica:** NAO planejar. NAO sugerir implementacao. Apenas observar e consolidar.

---

## Modo 2 -- DECISAO

**Quando usar:** Ciclo normal (nao e a primeira execucao do modulo FE).

**module-state.md: proibido ler.** Contexto vem do ES (`last_validate.details`). Consultar ES
(bloco acima) antes de decidir.

**Acao:**

1. Ler ES `module-state --module <MODULO> --layer fe` (ja executado).
2. Se `last_validate.details.next_action` disponivel → usar diretamente como routing.
3. Se ES indisponivel → ler module-state.md (secoes 4, 8, 9) para derivar:
   - score < 80 E plano existe E ultimo implement recente → **VALIDACAO**
   - gaps claros E plano existe → **IMPLEMENTADOR**
   - sem plano OU gaps estruturais → **PLANNER**
   - score >= 80 E todas issues DONE → **ENCERRAR**
4. Confirmar routing. Criterios:
   - **PLANNER** — gaps estruturais, plano ausente ou desatualizado
   - **IMPLEMENTADOR** — prioridade clara, plano valido, mudanca incremental
   - **VALIDACAO** — houve implementacao recente nao validada
   - **ENCERRAR** — score >= 80 e todas issues ativas DONE

**Saida obrigatoria:**
```
Orquestracao em execucao para <MODULO> (FE)
Modo: DECISAO
Proxima acao: <PLANNER | IMPLEMENTADOR | VALIDAR | ENCERRAR>
Motivo: <ES next_action | raciocinio>
```

---

## Modo 3 -- VALIDACAO

**Quando usar:** Apos implementacao concluida pelo `fe-implement`.

**module-state.md: proibido ler para derivar contexto.** Consultar ES (`last_validate.details`)
para obter estado anterior (score, checklist, gaps). Prosseguir diretamente para os gates abaixo.
module-state.md e atualizado (somente delta: secoes 2, 3, 4, 6, 7, 8, 9) apenas apos os gates passarem.

### Identificar Nx projects impactados

Ler `docs/architecture/frontend/plans/plan-FE-<MODULO>.md` (prioridade recem implementada)
para identificar quais libs e apps foram modificados.

### Executar gates

Rode o runner de gates (D-366):

```bash
python scripts/gates-run.py run --layer fe --project <project> \
  --gates lint,test,build,e2e --output tmp/gates.json --report
```

Repetir para cada Nx project impactado. Consolidar verdicts.

### Score deterministico + estado do checklist (D-317)

```bash
python scripts/validator-score.py score --issue <MODULO>-NNN --layer fe \
  --gates tmp/gates.json --report
```

Escreve estado consolidado: checklist das issues ativas (`DONE`/`PARTIAL`/`MISSING`/`BLOCKED`)
+ score agregado (structure/tests_lint/e2e) + `functionality` provisoria (`needsAgentConfirm`).
Voce confirma a functionality e avalia os soft (a11y / observability / multi-empresa enforcement).

### Gate de conformidade arquitetural

```bash
python scripts/arch-conformance.py check --layer fe --target frontend/libs/<module> --report
```

Exit 2 → devolva ao Implementador com o `conformance.json`. Demais (julgamento):

- `standalone: true` + `ChangeDetectionStrategy.OnPush` em todo `*.component.ts` novo.
- `takeUntilDestroyed()` (ou `async` pipe / `toSignal()`) em toda subscription nova.
- Facades expoem signals readonly (`.asReadonly()`).
- Sem `HttpClient` direto em components.
- `loadChildren` / `loadComponent` via path mappings (`@cordele/<modulo>/feature-*`).
- Sem permissao inline — via `AccessDecisionService.can(<permission>)`.
- **Multi-empresa:** chamadas HTTP usam `@cordele/shared/access-http-base` (interceptor `X-Empresa-Id`).
- Tags Nx corretas em todo `project.json` novo.

**Regras criticas:** NAO recriar module-state.md. NAO apagar historico. NAO reordenar conteudo.

---

## Template obrigatorio do module-state.md

No Modo 1 (BASELINE), quando o module-state.md nao existe, **escreva-o a partir da
estrutura de referencia abaixo** — o `doc-scaffold.py` nao emite este artefacto (os
`kinds` que conhece sao `vision-01..06` e `discovery-00..05`), e o gemeo BE tambem o
trata como escrito pelo agente.

Depois valide:

```bash
python scripts/render.py validate-output \
  --artifact docs/architecture/frontend/modules/<module>/frontend/module-state.md
```

Estrutura de referência — `docs/architecture/frontend/modules/<module>/frontend/module-state.md`:

```markdown
# <MODULE> Frontend — Module State
> Module: `frontend/libs/<module>/` | App: `cordele-web` | Modulo: `<MODULO>`

# 0. Visao Geral do Modulo FE
## Responsabilidades / Sublibsmodule (feature-*, data-access, ui, access) / Issues ativas

# 1. Arquitetura e Estrutura
## Stack (Angular + Nx) / Organizacao de sublibsmodule / Regras arquiteturais (boundaries, tax-map)
## Multi-empresa: interceptor @cordele/shared/access-http-base configurado?

# 2. Estado Atual da Implementacao
## Implementado (DONE) / Parcial (PARTIAL) / Nao implementado (MISSING) por issue

# 3. Qualidade e Evidencias
## Gates (lint/test/build/e2e) / Cobertura funcional / Conformidade UI (arch-conformance)

# 4. Gaps Atuais

# 5. Issues Relacionadas ao Modulo FE
## Lista de <MODULO>-FE-NNN e <MODULO>-INT-NNN com status e link

# 6. Score de Maturidade (0-100)

# 7. Historico de Evolucao (append-only)

# 8. Estado Atual Resumido (para agentes)
STRUCTURAL / FUNCTIONAL / INTEGRATION / OBSERVABILITY: OK | PARTIAL | LOW
MULTI-EMPRESA: OK | PARTIAL | LOW

# 9. Proxima Atencao Recomendada

END DOCUMENT
```

Regras: nunca alterar nomes de secoes, nunca alterar ordem, nenhuma secao vazia.

---

## Regras de status

Sempre usar: `DONE` | `PARTIAL` | `MISSING` | `BLOCKED`

## Score de maturidade (0-100)

- 0-39 Inicial | 40-59 Parcial | 60-79 Consistente | 80-100 Maduro

**Heuristica (referencia, somar):**
- 30 pts: sublibsmodule criadas + tags Nx ok + boundaries verdes
- 30 pts: funcionalidade alvo entregue (components, facades, signals funcionam)
- 20 pts: testes unit passando + lint sem warnings
- 10 pts: e2e do cenario principal verde
- 10 pts: observability + a11y + multi-empresa enforcement OK

> **Calculo (D-317):** `validator-score.py` computa parcelas objetivas; `functionality` e provisoria
> (`needsAgentConfirm`) e os soft ficam com voce.

---

## Mensagem final obrigatoria

```
Validator-Orchestrator FE executado para <MODULO>
Modo: <BASELINE | DECISAO | VALIDACAO>
Score: <0-100> — <Inicial | Parcial | Consistente | Maduro>
Issues ativas: <MODULO>-FE-NNN (<done>/<total> done), ...
Gates: lint=<OK|FAIL> test=<OK|FAIL> build=<OK|FAIL>
Multi-empresa enforcement: <OK | FAILED>
Proxima acao: <PLANNER | IMPLEMENTADOR | VALIDAR | ENCERRAR>
```

Após emitir a mensagem acima, registrar no journal (D-415 / D-420) conforme o modo:

- **BASELINE** → `--category VALIDATOR-BASELINE --status completed`
- **DECISAO** → `--category VALIDATOR-DECISION --status info`
- **VALIDACAO (gates OK)** → `--category VALIDATOR-VALIDATION --status completed`
- **VALIDACAO (gates FAIL)** → `--category VALIDATOR-VALIDATION --status failed`

Para BASELINE e DECISAO (sem details):

```bash
python scripts/pipeline_events.py emit \
  --category <ver acima> \
  --actor "/fe-validator" \
  --message "<MODULO> FE <modo> — <resumo de uma linha>" \
  --module <MODULO> \
  --layer fe \
  --stage validate \
  --status <ver acima>
```

Para **VALIDACAO** (obrigatório incluir `--details`):

```bash
DETAILS='{"score":<N>,"maturity":"<Inicial|Parcial|Consistente|Maduro>","checklist":{"done":<N>,"total":<N>,"gaps":["<gap1>"]},"gates":{"build":"<pass|fail>","test":"<pass|fail>","lint":"<pass|fail>"},"next_action":"<PLANNER|IMPLEMENTADOR|VALIDACAO|ENCERRAR>"}'
python scripts/pipeline_events.py emit \
  --category VALIDATOR-VALIDATION \
  --actor "/fe-validator" \
  --message "<MODULO> FE VALIDACAO — gates lint=<X> test=<X> build=<X>; score <N>/100 <maturity>" \
  --module <MODULO> \
  --layer fe \
  --stage validate \
  --status <completed|failed> \
  --details "$DETAILS"
```
