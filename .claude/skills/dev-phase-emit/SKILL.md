---
name: dev-phase-emit
description: Emite evento de fase via pipeline_events.py + regista no journal. Invocar ao terminar cada fase de execução. Requer COMMAND, STAGE, CATEGORY, STATUS, CLIENT_ID e MODULE no contexto.
user-invocable: false
tools: Bash
---

# Dev Phase Emit

Executar após concluir o trabalho da fase. As variáveis `COMMAND`, `STAGE`, `CATEGORY`,
`STATUS`, `CLIENT_ID` e `MODULE` devem estar no contexto.

## 1 — Emit evento

```bash
python scripts/pipeline_events.py emit \
  --client <CLIENT_ID> --module <MODULE> \
  --category <CATEGORY> --actor "<COMMAND>" \
  --stage <STAGE> --status <STATUS> \
  --message "<MODULE> <STAGE> <STATUS>"
```

## 2 — Journal

```bash
python scripts/journal.py append \
  --category <CATEGORY> --actor "<COMMAND>" \
  --module <MODULE> --stage <STAGE> --status <STATUS>
```

Ambos são best-effort — se falharem, continuar e registar no resumo final.
