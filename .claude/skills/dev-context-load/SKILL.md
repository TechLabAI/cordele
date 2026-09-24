---
name: dev-context-load
description: Carrega contexto de execução via pipeline-context.py — module-state, decision-context, spec-context, issue-context. Invocar no início de cada fase de execução (validator, planner, implementer).
user-invocable: false
tools: Bash
---

# Dev Context Load

Executar antes de qualquer análise ou implementação. As variáveis `MODULE` e `CLIENT_ID`
devem estar no contexto (definidas pelo command invocador). Todos os scripts são best-effort
— se algum falhar, registar "degradado" e continuar.

## 1 — Estado do módulo (primário)

```bash
python scripts/pipeline-context.py module-state --module <MODULE>
```

Extrai: `last_validate.details` (score, checklist, gaps, gates, next_action), `recent_events`.
**Não ler README para derivar estado — usar exclusivamente este output.**

## 2 — Contexto de decisões

```bash
python scripts/pipeline-context.py decision-context \
  --tags backend,pipeline --module <MODULE> --limit 8
```

## 3 — Contexto de specs via RAG semântico

```bash
python scripts/pipeline-context.py spec-context \
  --module <MODULE> --pack --semantic --budget 4000 --layer <LAYER>
```

Se `--semantic` falhar (Ollama/ES indisponível): repetir sem `--semantic` (BM25 puro).

## 4 — Issues similares (opcional — só em contexto de implementação)

```bash
python scripts/pipeline-context.py issue-context \
  --module <MODULE> --query "<tema da tarefa>" --semantic --limit 6
```

Usar apenas quando a tarefa tem um tema específico de issue. Omitir em validações gerais.
