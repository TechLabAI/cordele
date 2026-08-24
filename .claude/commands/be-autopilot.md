---
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Agent
---

# BE Autopilot -- Meta-Orchestrator (Cordelê)

> **Higiene de contexto (D-463):** execute `/clear` ao iniciar uma nova atividade.
> O contexto vem do RAG (injetado por este command) — não do histórico acumulado.
> Dentro de uma atividade longa, prefira `/compact` em vez de `/clear`.

Voce e o orquestrador central do pipeline IA-First do backend Cordelê (Node 22 + NestJS, arquitetura hexagonal).

Detecta o estado do modulo, executa o pipeline correto (Architect ou Implement) e
salva checkpoints (crash recovery + retomada manual via `--resume`).

**Input:** `$ARGUMENTS`

Formatos aceitos:
- `<MODULO>` (ex.: `IMP`) → detecta automaticamente: se o modulo ainda nao tem scaffold → **Pipeline A** (Architect); se ja tem → **Pipeline B** (Implement, loop validator-driven).
- `<MODULO> --architect` → forca **Pipeline A** (re-arquitetar / novo modulo).
- `<MODULO> --implement` → forca **Pipeline B** (ciclo de desenvolvimento).
- `<MODULO> --resume` → retomar de checkpoint salvo.

Modulos validos: determinados em runtime via `pipeline-guard.py resolve` (D-393).

---

## Principio central

**Uma unica chamada para resolver tudo.** O autopilot delega para sub-agents com
model routing (D-411): `validator-agent` (haiku), `planner-agent` (sonnet),
`implementer-agent` (sonnet). Cada agent le o protocolo do seu command `.md` e
executa com o tier correto. Architect steps (Pipeline A) continuam inline.
Checkpoints sao salvos em disco apos cada etapa pesada para permitir retomada se a
sessao for interrompida, mas o autopilot **NAO interrompe o fluxo do usuario**:
prossegue para a proxima etapa imediatamente.

---

## Passo 0 -- Deteccao de modo

1. Parseie a invocação pelo detector determinístico (D-370), sem fazê-lo à mão:
   ```
   python scripts/autopilot-state.py detect "$ARGUMENTS" --layer be
   ```
   Ele devolve `{module, id, mode, pipeline, service}`.
2. Validar módulo (D-393): `python scripts/pipeline-guard.py resolve --module <MODULO>`
   - Exit 0 → módulo válido; usar o JSON retornado para resolver `service` e `serviceDocsDir`.
   - Exit não-zero → módulo ausente em `modules.registry`. **Parar** — o script já imprimiu os válidos.
3. Se `mode == "resume"`: ler o checkpoint (`autopilot-state.py load --dir tmp/be-autopilot/<MODULO>`) e pular para a etapa salva.
4. Se contem `--architect`: **Pipeline A**.
5. Se contem `--implement`: **Pipeline B**.
6. Caso contrario, detectar pelo estado em disco:
   - Se `backend/services/<service>/` NAO existe (modulo ainda nao scaffoldado) → **Pipeline A**, e ao terminar, encadear para **Pipeline B**.
   - Se ja existe → **Pipeline B**.
7. ID do checkpoint = `<MODULO>`.
8. **Abrir o trace do run (F2 / D-423):**
   ```bash
   python scripts/pipeline_events.py trace-start --command /be-autopilot --module <MODULO>
   ```
   Minta o `trace_id` uma vez no inicio do run. Todos os eventos emitidos pelos
   sub-agentes (validator/planner/implement) e — em F4 — as chamadas ao techlab-ai
   herdam esse `trace_id` automaticamente (lido de `.techlab/trace-context.json`),
   correlacionando o ciclo inteiro. Em `--resume`, NAO reabrir: reaproveitar o trace existente.

> `<service>` = nome do servico backend do modulo (default `<modulo-lowercase>-service`), conforme `modules.registry` em `project-context.json`.

---

## Checkpoint -- como funciona

Apos cada etapa pesada, salve via o script (D-370) — NÃO serialize o JSON à mão.
Ele escreve atomicamente em `tmp/be-autopilot/<MODULO>/state.json`, carimba o
timestamp e (com `--inc-iteration`) aplica o cap de segurança (exit 2 se passar de 5):

```
python scripts/autopilot-state.py save --dir tmp/be-autopilot/<MODULO> \
  --module <MODULO> --service <service> --pipeline <architect|implement> \
  --step <etapa concluida> --next <proxima etapa> --progress <P> --inc-iteration
```

Campos do checkpoint: `id, pipeline, module, service, currentStep, nextStep,
progressUnit, iteration, timestamp, notes, capReached`.

Apos salvar, emitir linha de status curta e prosseguir:

```
Checkpoint: <currentStep> -> <nextStep> (progressUnit=<P>, iter=<N>)
```

O autopilot encerra a invocacao apenas em 3 casos:
- **Safety cap** atingido (5 iteracoes do loop B2->B5).
- **Erro irrecuperavel** ou intervencao manual obrigatoria (`nextStep: "blocked"`).
- **Finalizacao** da pipeline.

Nesses casos, reportar o motivo e instruir `/be-autopilot <MODULO> --resume` se cabivel.

---

## Pipeline A -- Architect (novo modulo / re-arquitetura)

Input: `<MODULO>`. Produz docs 01..06 + ADR skeleton, contratos, backlog e o
esqueleto executavel do servico.

### Etapa A1 -- Vision

1. Verificar se `docs/architecture/backend/services/<service>/01-*.md` ja existe.
   - Se existe e completo: pular para A2.
2. Executar protocolo de `.claude/commands/be-architect-vision.md` com `<MODULO>`.
3. Checkpoint (`currentStep: "vision"`, `nextStep: "specs"`).
4. Prosseguir automaticamente para A2.

### Etapa A2 -- Specs

1. Verificar pre-requisito: docs 01..06 do modulo existem.
2. Verificar se os contratos (`api`, `data-model`, `events`) ja existem.
   - Se existem: pular para A3.
3. Executar protocolo de `.claude/commands/be-architect-specs.md` com `<MODULO>`.
4. Checkpoint (`currentStep: "specs"`, `nextStep: "backlog"`).
5. Prosseguir para A3.

### Etapa A3 -- Backlog

1. Verificar pre-requisito: contratos do modulo existem.
2. Verificar se `plan-<MODULO>.md` + issues ja existem.
   - Se existem: pular para A4.
3. Executar protocolo de `.claude/commands/be-architect-backlog.md` com `<MODULO>`.
4. Checkpoint (`currentStep: "backlog"`, `nextStep: "scaffold"`).
5. Prosseguir para A4.

### Etapa A4 -- Scaffold

1. Verificar pre-requisitos: issues atomicas + `plan-<MODULO>.md`.
2. Executar protocolo de `.claude/commands/be-architect-scaffold.md` com `<MODULO>`
   (o script Python gera o esqueleto executavel do servico; o autopilot NAO gera arquivos).
3. Checkpoint (`currentStep: "scaffold"`, `nextStep: "implement-loop"`).
4. Ir para Pipeline B (Etapa B1) automaticamente -- o modulo agora tem scaffold.

### Finalizacao Pipeline A (quando rodado com `--architect`, sem encadear)

```
Pipeline Architect concluido para <MODULO> (<service>)
Etapas executadas: vision -> specs -> backlog -> scaffold
Para iniciar o ciclo de desenvolvimento:
-> /be-autopilot <MODULO> --implement
```

Registrar no journal (D-415):

```bash
python scripts/pipeline_events.py emit \
  --category COMMAND-END \
  --actor "/be-autopilot" \
  --message "<MODULO> (<service>) architect pipeline concluido — vision→specs→backlog→scaffold OK" \
  --module <MODULO> \
  --stage scaffold \
  --status completed
```

---

## Pipeline B -- Implement (ciclo validator-driven)

Input: `<MODULO>` ja scaffoldado. Itera sobre as prioridades do plano ate o checklist
fechar ou o safety cap ser atingido.

### Etapa B1 -- Baseline (Validator Modo 1)

1. Delegar ao `validator-agent` (D-411 — haiku tier):
   - Input: `<MODULO> --baseline`
   - O agent le `.claude/commands/be-validator.md` e executa Modo 1 (BASELINE):
     consolida estado real, calcula score (0-100), atualiza plano/issues.
   - Aguardar a mensagem final do agent (contém score e Done/Total).
2. Se score >= 80 e checklist 100% DONE: ir para Finalizacao.
3. Checkpoint (`currentStep: "baseline"`, `nextStep: "decision"`, notes com score e done/total).
4. Prosseguir para B2.

### Etapa B2 -- Decisao (Validator Modo 2)

1. Rode o motor de decisão determinístico (D-367) — mesma lógica do validator,
   sem re-derivar (não duplique a árvore aqui):
   ```
   python scripts/validator-decide.py decide --issue <MODULO>-NNN --layer be
   ```
   Roteie pelo `nextAction` retornado:
   - **PLANNER** → ir para B3
   - **IMPLEMENTADOR** → ir para B4
   - **VALIDACAO** → ir para B5
   - **ENCERRAR** → Finalizacao
2. Nao salvar checkpoint aqui (etapa leve). Prosseguir imediatamente.

### Etapa B3 -- Planner

1. Delegar ao `planner-agent` (D-411 — sonnet tier):
   - Input: `<MODULO>`
   - O agent le `.claude/commands/be-planner.md` e produz/atualiza `plan-<MODULO>.md`.
   - Aguardar a mensagem final do agent (contém prioridades geradas e prioridade alvo).
2. Extrair prioridade alvo da mensagem final do planner-agent.
3. Checkpoint (`currentStep: "planner"`, `nextStep: "implement"`, `prioridade: "<P alvo>"`).
4. Prosseguir para B4 com a prioridade alvo.

### Etapa B4 -- Implement (uma prioridade por vez)

1. Delegar ao `implementer-agent` (D-411 — sonnet tier):
   - Input: `<MODULO> <PRIORIDADE>` (ex.: `PED P2`)
   - O agent le `.claude/commands/be-implement.md` e implementa **uma unica prioridade**
     seguindo exatamente a ordem das fases do plano (sem rodar `pnpm test`).
   - Aguardar a mensagem final do agent (confirma prioridade executada e escopo respeitado).
2. Checkpoint (`currentStep: "implement"`, `nextStep: "validate"`, `prioridade: "<P>"`).
3. Prosseguir para B5.

### Etapa B5 -- Validacao Leve (Validator Modo 3 `--light`, D-472)

Roda apenas `lint` + `arch-conformance` — sem `test/build/e2e`. Reduz custo de tokens
por prioridade; a suíte completa é diferida para B6 ao final do ciclo.

1. Delegar ao `validator-agent` (D-411 — haiku tier) para Modo 3 leve:
   - Input: `<MODULO> --validacao --light`
   - O agent le `.claude/commands/be-validator.md` e executa Modo 3 tier leve:
     gate `lint`, conformidade arquitetural, atualiza checklist + bloco de status.
     `test`, `build` e `e2e` ficam como `"deferred"` no gates.json.
   - Aguardar a mensagem final do agent (contém resultado do lint e score parcial).
2. Se lint passa E checklist 100% DONE E score >= 80: sair do loop e ir para **B6**.
3. Se lint passa mas checklist incompleto:
   - Incrementar `iteration`.
   - Se `iteration` > 5: parar com safety cap (ver abaixo); depois ir para B6.
   - Checkpoint (`currentStep: "validate-partial"`, `nextStep: "decision"`).
   - Voltar para B2 (Decisao) e prosseguir automaticamente (proxima prioridade).
4. Se lint falha ou conformance exit 2:
   - Checkpoint (`currentStep: "validate-failed"`, `nextStep: "decision"`, notes com erro).
   - Voltar para B2 (Decisao) com o diagnostico do erro e prosseguir automaticamente.

### Etapa B6 -- Validacao Completa (Validator Modo 4, D-472)

Executada **uma unica vez** apos o loop B2→B5 encerrar (checklist completo ou safety cap).
Roda a suite completa de testes: `test,build,e2e,lint`.

1. Delegar ao `validator-agent` (D-411 — haiku tier) para Modo 4 (FULL-VALIDACAO):
   - Input: `<MODULO> --full-validacao`
   - O agent executa: `gates-run.py --gates test,build,e2e,lint` + `arch-conformance.py`
     + `validator-score.py` com todos os gates preenchidos.
   - Aguardar a mensagem final do agent (score final + resultado de todos os gates).
2. Se todos os gates passam: ir para Finalizacao.
3. Se algum gate falha:
   - Checkpoint (`currentStep: "full-validate-failed"`, `nextStep: "decision"`, notes com falhas).
   - Voltar para B2 (Decisao) com o diagnostico detalhado; loop B2→B5 resolve as falhas.
   - Ao fechar o loop novamente, retornar a B6 (nova rodada de suite completa).
   - B6 **nao conta** para o contador de `iteration` do safety cap — o cap aplica-se apenas ao loop leve.

### Finalizacao Pipeline B

Executada apenas apos B6 (FULL-VALIDACAO) passar com sucesso.

```
Autopilot concluido para <MODULO> (<service>)
Score de maturidade: <0-100> -- <Inicial | Parcial | Consistente | Maduro>
Done/Total: <X/Y>
Gates: lint OK (per-priority) | test OK | build OK | e2e OK (suite completa B6)
Arquitetura hexagonal: OK
Multi-empresa enforcement: OK
Iteracoes loop leve: <N> | Rodadas FULL-VALIDACAO: <M>
Modulo com checklist 100% DONE.
```

Registrar no journal (D-415):

```bash
python scripts/pipeline_events.py emit \
  --category COMMAND-END \
  --actor "/be-autopilot" \
  --message "<MODULO> (<service>) implement pipeline concluido — score <X> — <N> iteracoes leve — FULL-VALIDACAO OK" \
  --module <MODULO> \
  --stage implement \
  --status completed
```

Depois de registrar, fechar o trace do run (F2 / D-423):

```bash
python scripts/pipeline_events.py trace-end
```

---

## Safety cap -- limite de iteracoes

Maximo de **5 iteracoes** do loop leve B2→B5 por invocacao. Se atingir o limite:

1. Emitir checkpoint + mensagem de status.
2. **Prosseguir para B6 (FULL-VALIDACAO)** — mesmo com checklist incompleto, a suite
   completa roda para capturar o estado real de testes antes de interromper.
3. Apos B6 (passe ou falhe), interromper e aguardar `--resume`.

```
Safety cap atingido (5 iteracoes loop leve).
Score parcial: <score>
Done/Total: <X/Y>
Ultimo gate lint: <resultado>
Iniciando B6 (FULL-VALIDACAO) antes de interromper...
```

Apos B6:

```
FULL-VALIDACAO concluida.
Gates: test=<X> build=<X> e2e=<X> lint=<X>
Score final: <score>

O modulo nao esta concluido. Para continuar:
-> /be-autopilot <MODULO> --resume
   (o contador de iteracoes reinicia ao retomar)
```

Registrar no journal (D-415):

```bash
python scripts/pipeline_events.py emit \
  --category AUTOPILOT-CHECKPOINT \
  --actor "/be-autopilot" \
  --message "<MODULO> (<service>) safety cap atingido — score <X> — <X/Y> done — FULL-VALIDACAO executada" \
  --module <MODULO> \
  --stage implement \
  --status blocked
```

---

## Regras gerais

- **Nao duplicar logica dos sub-commands.** Ler e seguir o protocolo do `.md` referenciado.
- **Encadear etapas automaticamente.** Apos salvar checkpoint, prosseguir imediatamente
  para a proxima etapa na mesma invocacao. Nao instruir o usuario a executar `/clear`
  ou `--resume` no fluxo normal.
- **Sempre salvar checkpoint apos etapa pesada.** Serve como crash recovery e como
  ponto manual de `--resume`.
- **Criar diretorio de checkpoint** no inicio: `tmp/be-autopilot/<MODULO>/` (versionado, D-041).
- **Se `--resume` e `state.json` nao existe**: tratar como fresh start.
- **Nao rodar etapas ja concluidas** -- usar checks de pre-requisito (arquivo existe?) para skip.
- **Uma prioridade por vez** no B4 -- nunca misturar prioridades numa mesma invocacao do be-implement.
- **Multi-empresa enforcement** e parte do Validator Modo 3 (B5) -- nao pular.

---

## Impacto nos commands existentes

**ZERO.** Este command e aditivo puro:
- Nao modifica os commands BE individuais (`be-architect-*`, `be-validator`, `be-planner`, `be-implement`).
- Delega para eles via leitura do `.md` referenciado.
- Os commands individuais continuam funcionando quando chamados diretamente.

---

## Mensagem inicial obrigatoria (ao comecar)

```
BE Autopilot iniciado
Input: <$ARGUMENTS>
Pipeline: <A (Architect) | B (Implement)>
Modulo: <MODULO> (<service>)
Modo: <fresh | resume>
Estado: <checkpoint lido ou "novo">
Iniciando etapa: <nome>
```
