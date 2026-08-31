---
name: master-plan-status
description: Tabela de progresso BE+FE do master plan. Sem LLM.
disable-model-invocation: true
tools: Bash
---

# Master Plan Status

```bash
cat docs/architecture/backend/plans/architecture-master-plan.md 2>/dev/null || echo "(sem master-plan BE)"
echo
cat docs/architecture/frontend/plans/architecture-master-plan.md 2>/dev/null || echo "(sem master-plan FE)"
```

Uso: `/master-plan-status`
