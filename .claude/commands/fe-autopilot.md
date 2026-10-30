---
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# FE Autopilot -- Meta-Orchestrator (Cordelê)

> **Higiene de contexto (D-463):** execute `/clear` ao iniciar uma nova atividade.
> O contexto vem do RAG (injetado por este command) — não do histórico acumulado.
> Dentro de uma atividade longa, prefira `/compact` em vez de `/clear`.
>
> **Nunca ataque issues/tickets diretamente via `Bash` no chat principal** (build,
> teste, fix manual issue-a-issue) — mesmo para "só um fix rápido". Esse padrão
> (medido: D-622) acumula todo o output verbatim de cada issue no contexto do
> orquestrador e é reenviado via cache a cada turno seguinte, inflando o consumo em
> ordens de magnitude sem nenhuma delegação a subagent. **Sempre** passe pelo
> `fe-implementer-agent`/`fe-validator-agent` (Etapas B3-B5) — mesmo para 1 issue avulsa.
> **Reinicie a sessão** (não apenas `/resume` no mesmo chat) ao trocar de módulo, e
> ao retomar após um gap longo (> algumas horas) de inatividade do autopilot.

Voce e o orquestrador central do pipeline IA-First do frontend Cordelê (Angular + Nx).

Detecta o tipo de tarefa, executa o pipeline correto e salva checkpoints (crash
recovery + retomada manual via `--resume`).

**Input:** `$ARGUMENTS`

Formatos aceitos (D-422 module-oriented):
- `<MODULO> <feature-slug>` (ex.: `<MODULE> cadastro-cliente`) → **Pipeline A** (Architect — nova feature em modulo existente)
- `<MODULO>` (ex.: `<MODULE>`) → **Pipeline B** (Implement — ciclo de execucao do modulo)
- `<MODULO> <feature-slug> --resume` → Retomar Pipeline A de checkpoint salvo
- `<MODULO> --resume` → Retomar Pipeline B de checkpoint salvo

Modulos validos no FE: IMP | COMP | PUB | PROJ

---

## Principio central

**Uma unica chamada para resolver tudo.** O autopilot delega para os sub-commands
existentes (nao duplica logica) e encadeia as etapas automaticamente em uma unica
invocacao. Checkpoints sao salvos em disco apos cada etapa pesada para permitir
retomada se a sessao for interrompida -- mas o autopilot **NAO interrompe o fluxo
do usuario**: prossegue para a proxima etapa imediatamente.

---

## Passo 0 -- Deteccao de modo

1. Extrair `$ARGUMENTS`.
2. Se contem `--resume`: ler checkpoint em `tmp/fe-autopilot/<ID>/state.json` e pular
   para a etapa salva.
3. Se input tem 2 tokens onde o primeiro e MODULO valido (IMP/COMP/PUB/PROJ)
   e o segundo e kebab-case: **Pipeline A**. ID = `<MODULO>-<feature-slug>`.
4. Se input tem apenas MODULO (sem segundo token ou segundo token e flag `--resume`):
   **Pipeline B**. ID = `<MODULO>`.
5. Se ambiguo: perguntar ao usuario.
6. **Abrir o trace do run (F2 / D-423):**
   ```bash
   python scripts/pipeline_events.py trace-start --command /fe-autopilot --module <MODULO>
   ```
   Minta o `trace_id` uma vez no inicio. Todos os eventos dos sub-agentes
   (validator/planner/implement) e — em F4 — as chamadas ao techlab-ai herdam esse
   `trace_id` (lido de `.techlab/trace-context.json`), correlacionando o ciclo.
   Em `--resume`, NAO reabrir: reaproveitar o trace existente.

---

## Checkpoint -- como funciona

Apos cada etapa pesada, salvar estado em `tmp/fe-autopilot/<ID>/state.json`:

```json
{
  "id": "<ID>",
  "pipeline": "architect | implement",
  "modulo": "<MODULO>",
  "feature": "<feature-slug>",
  "currentStep": "<nome da etapa concluida>",
  "nextStep": "<nome da proxima etapa>",
  "progressUnit": "1",
  "iteration": 1,
  "timestamp": "2026-05-19T14:30:00Z",
  "notes": "<contexto minimo para retomar>"
}
```

Apos salvar, emitir linha de status curta e prosseguir:

```
Checkpoint: <currentStep> -> <nextStep> (progressUnit=<N>, iter=<N>)
```

O autopilot encerra a invocacao apenas em 3 casos:
- **Safety cap** atingido (5 iteracoes do loop B2->B5).
- **Erro irrecuperavel** ou intervencao manual obrigatoria (`nextStep: "blocked"`).
- **Finalizacao** da pipeline.

Nesses casos, reportar o motivo e instruir `/fe-autopilot <ID> --resume` se cabivel.

---

## Pipeline A -- Architect (nova feature em modulo existente)

Input: `<MODULO> <feature-slug>` (ex.: `<MODULE> cadastro-cliente`).

ID derivado: `<MODULO>-<feature-slug>` (ex.: `<MODULE>-cadastro-cliente`).

### Etapa A0 -- Semente de prototipo (automatico — D-383)

O protótipo Angular populado do Estágio 0 (Tailwind v4 + CDK + theme.css oklch)
ja foi vendorizado em `frontend/design-reference/` pelo `/new-project` (P5). Nao
ha passo separado de "from prototype" (comando aposentado em D-382): as
telas-semente sao **adotadas** durante backlog/scaffold/implement — o contrato
da issue aponta a tela correspondente. Seguir direto para A1.

### Etapa A1 -- Discover

1. Verificar pre-requisitos: SPECs do modulo + generator-config.yml + issues-map.md +
   ADRs aceitos + multi-empresa.md.
   - Se faltam: reportar e bloquear (`nextStep: "blocked"`).
2. Verificar se `docs/architecture/frontend/modules/<modulo>/frontend/frontend-spec/features/<feature-slug>/conformance-report.md`
   ja existe.
   - Se existe e status == aderente: pular para A2.
3. Executar protocolo de `.claude/commands/fe-feature-architect-discover.md`.
4. Se status == ❌ Violador: bloquear (`nextStep: "blocked"`).
5. Checkpoint (`currentStep: "discover"`, `nextStep: "spec-delta"`).
6. Prosseguir automaticamente para A2.

### Etapa A2 -- Spec Delta

1. Verificar conformance-report existe e status != ❌ Violador.
2. Verificar se `spec-delta.md` ja existe.
   - Se existe: pular para A3.
3. Executar protocolo de `.claude/commands/fe-feature-architect-spec-delta.md`.
4. Checkpoint (`currentStep: "spec-delta"`, `nextStep: "backlog"`).
5. Prosseguir para A3.

### Etapa A3 -- Backlog

1. Verificar `spec-delta.md` + `generator-config.yml` (atualizado) existem.
2. Verificar se issues `<MODULO>-FE-NNN` da feature ja existem (ler `issues-map.md`).
   - Se existem: pular para A4.
3. Executar protocolo de `.claude/commands/fe-feature-architect-backlog.md`.
4. Checkpoint (`currentStep: "backlog"`, `nextStep: "scaffold"`).
5. Prosseguir para A4.

### Etapa A4 -- Scaffold

1. Verificar pre-requisitos: issues + plan + generator-config.yml.
2. Executar protocolo de `.claude/commands/fe-feature-architect-scaffold.md`.
3. Verificar gates: `nx lint`, `nx test`, `nx build`.
4. Checkpoint (`currentStep: "scaffold"`, `nextStep: "done"`).
5. Ir para Finalizacao.

### Finalizacao Pipeline A

```
Pipeline Architect concluido para <MODULO>/<feature-slug>
Etapas executadas: discover -> spec-delta -> backlog -> scaffold
Issues geradas: <lista <MODULO>-FE-NNN..NNN+K>

Para comecar o ciclo de execucao do modulo (D-422 module-oriented):
-> /fe-autopilot <MODULO>
```

---

## Pipeline B -- Implement (ciclo de execucao do modulo FE)

Input: `<MODULO>` (ex.: `<MODULE>`). D-422: module-oriented.

### Etapa B1 -- Baseline (Validator Modo 1)

1. **Skip check:** consultar ES `module-state --module <MODULO> --layer fe`.
   Se `last_validate.details.score >= 80` e checklist DONE: ir para Finalizacao.
2. Delegar ao `fe-validator-agent` (D-421 — haiku tier):
   - Input: `<MODULO>`
   - O agent le `.claude/commands/fe-validator.md` e executa Modo 1 (BASELINE).
   - Aguardar a mensagem final do agent.
3. Se score >= 80 e todas issues DONE: ir para Finalizacao.
4. Checkpoint (`currentStep: "baseline"`, `nextStep: "decision"`, notes com score).
5. Prosseguir para B2.

### Etapa B2 -- Decisao (Validator Modo 2)

1. Ler ES `module-state --module <MODULO> --layer fe`:
   - `last_validate.details.next_action` → routing direto
   - Se ES indisponivel: derivar de score + plano existente
2. Roteie pelo `next_action`:
   - **PLANNER** → ir para B3
   - **IMPLEMENTADOR** → ir para B4
   - **VALIDACAO** → ir para B5
   - **ENCERRAR** → Finalizacao
3. Nao salvar checkpoint aqui (etapa leve). Prosseguir imediatamente.

### Etapa B3 -- Planner

1. Delegar ao `fe-planner-agent` (D-421 — sonnet tier):
   - Input: `<MODULO>`
   - O agent le `.claude/commands/fe-planner.md` e executa o protocolo.
   - Aguardar a mensagem final do agent.
2. Plano gerado: `docs/architecture/frontend/plans/plan-FE-<MODULO>.md`.
3. Checkpoint (`currentStep: "planner"`, `nextStep: "implement"`, `priority: P1`).
4. Prosseguir para B4 (P1).

### Etapa B4 -- Implement

1. Delegar ao `fe-implementer-agent` (D-421 — sonnet tier):
   - Input: `<MODULO> P<N>`
   - O agent le `.claude/commands/fe-implement.md` e executa o protocolo para a prioridade atual.
   - Aguardar a mensagem final do agent.
2. Checkpoint (`currentStep: "implement"`, `nextStep: "validate"`, `priority: P<N>`).
3. Prosseguir para B5.

### Etapa B5 -- Validacao (Validator Modo 3)

1. Delegar ao `fe-validator-agent` (D-421 — haiku tier):
   - Input: `<MODULO>`
   - O agent le `.claude/commands/fe-validator.md` e executa Modo 3 (VALIDACAO).
   - Aguardar a mensagem final do agent.
2. Se gates passam E score >= 80 E todas issues DONE: ir para Finalizacao.
3. Se gates passam mas restam prioridades:
   - Incrementar iteration. Se iteration > 5: safety cap.
   - Checkpoint (`currentStep: "validate-partial"`, `nextStep: "decision"`, `priority: P<N+1>`).
   - Voltar para B2 (Decisao) e prosseguir automaticamente.
4. Se gates falham:
   - Checkpoint (`currentStep: "validate-failed"`, `nextStep: "decision"`, notes com erro).
   - Voltar para B2 (Decisao) com diagnostico do erro e prosseguir automaticamente.

### Finalizacao Pipeline B

```
Autopilot FE concluido para <MODULO>
Score de maturidade: <0-100> -- <Inicial | Parcial | Consistente | Maduro>
Issues ativas: <lista <MODULO>-FE-NNN> todas DONE
Gates: lint OK | test OK | build OK
Multi-empresa enforcement: OK
Iteracoes: <N>
Modulo encerrado. Score >= 80.

Proximo modulo? Inicie uma sessao nova (D-622) -- nao continue neste chat.
```

Apos a finalizacao, fechar o trace do run (F2 / D-423):

```bash
python scripts/pipeline_events.py trace-end
```

---

## Safety cap -- limite de iteracoes

Maximo de **5 iteracoes** do loop B2→B5 por invocacao. Se atingir o limite:

```
Safety cap atingido (5 iteracoes).
Score atual: <score>
Prioridade atual: P<N>
Ultimo gate: <resultado>

O modulo nao esta concluido. Para continuar:
-> /fe-autopilot <MODULO> --resume
   (o contador reinicia ao retomar)

Se a retomada for depois de um gap longo (horas), inicie sessao nova (D-622) em vez
de continuar neste chat -- o checkpoint em disco carrega o estado, nao o historico.
```

---

## Regras gerais

- **Nao duplicar logica dos sub-commands.** Ler e seguir o protocolo do `.md` referenciado.
- **Encadear etapas automaticamente.** Apos salvar checkpoint, prosseguir imediatamente
  para a proxima etapa na mesma invocacao. Nao instruir o usuario a executar `/clear`
  ou `--resume` no fluxo normal.
- **Sempre salvar checkpoint apos etapa pesada.** Serve como crash recovery e como
  ponto manual de `--resume`.
- **Criar diretorio de checkpoint** no inicio: `tmp/fe-autopilot/<ID>/`.
- **Se `--resume` e `state.json` nao existe**: tratar como fresh start.
- **Nao rodar etapas ja concluidas** -- usar checks de pre-requisito (arquivo existe?) para skip.
- **Multi-empresa enforcement** e parte do Validator Modo 3 (B5) -- nao pular.
- **Nunca implementar/corrigir diretamente via `Bash` no contexto do orquestrador** (D-622) --
  mesmo um fix de 1 linha em resposta a uma falha do B5 vai para o `fe-implementer-agent`
  (B3->B4), nunca para uma edicao ad-hoc no chat do autopilot. O orquestrador so le
  diagnostico (score, gates); quem edita codigo e sempre o agent isolado.
- **Trocar de sessao ao trocar de modulo** (D-622, extensao do D-463): ao terminar
  Finalizacao ou ao pausar por safety cap com um gap de retomada longo, recomendar
  explicitamente ao operador iniciar sessao nova para o proximo `/fe-autopilot <MODULO>`
  em vez de continuar no mesmo chat -- ver mensagens de Finalizacao/Safety cap abaixo.

---

## Impacto nos commands existentes

**ZERO.** Este command e aditivo puro:
- Nao modifica os 8 commands FE individuais.
- Delega para eles via leitura do `.md` referenciado.
- Os commands individuais continuam funcionando quando chamados diretamente.

---

## Mensagem inicial obrigatoria (ao comecar)

```
FE Autopilot iniciado
Input: <$ARGUMENTS>
Pipeline: <A (Architect) | B (Implement)>
ID: <ID>
Modo: <fresh | resume>
Estado: <checkpoint lido ou "novo">
Iniciando etapa: <nome>
```
