---
name: pipeline-status
description: Estado actual do módulo via ES — últimos eventos, score, gates. Sem LLM.
disable-model-invocation: true
tools: Bash
---

# Pipeline Status

```bash
python scripts/pipeline-context.py module-state --module $1
```

Uso: `/pipeline-status <MODULE>`
