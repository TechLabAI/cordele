# Pole Position split — COMP (be)

> Gerado por `pole-position-split.py` a partir de `docs\architecture\backend\plans\plan-COMP.md`.
> Terminais: 3 (pedidos: 3). Ownership de arquivo disjunto.
> O planner enriquece a narrativa; o split (arquivos por terminal) é determinístico.

## ⚠️ Avisos

- some units declare no file targets — their split is by unit only (ownership not verifiable). Add 'Alvos de alteração' paths to the plan.

## Setup de worktrees (humano, uma vez)

```bash
git worktree add ../comp-t1 -b stream/comp-t1
git worktree add ../comp-t2 -b stream/comp-t2
git worktree add ../comp-t3 -b stream/comp-t3
```

## Streams

| Terminal | Branch | Unidades | Arquivos (owned) |
|---|---|---|---|
| t1 | `stream/comp-t1` | P1, P4, P7 | 2 |
| t2 | `stream/comp-t2` | P2, P5, P8 | 12 |
| t3 | `stream/comp-t3` | P3, P6 | 3 |

### Terminal t1 — `stream/comp-t1`

**Unidades:** P1, P4, P7

**Arquivos sob sua responsabilidade (não tocar fora desta lista):**

- `project-context.json`
- `src/modules/comp/comp.tokens.ts`

**Prompt de kick-off:**

```
Você implementa o terminal t1 do split pole-position de COMP.
Branch: stream/comp-t1. Nunca trocar de branch.
Plano-fonte: docs\architecture\backend\plans\plan-COMP.md
Suas unidades: P1, P4, P7.
Toque SOMENTE os arquivos listados acima. Se precisar de um arquivo
de outro terminal, pare e sinalize — não edite fora do seu ownership.
Siga o plano para suas unidades; rode os testes locais antes de marcar pronto.
```

### Terminal t2 — `stream/comp-t2`

**Unidades:** P2, P5, P8

**Arquivos sob sua responsabilidade (não tocar fora desta lista):**

- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
- `docs/architecture/backend/adr/ADR-002-modular-monolith.md`
- `docs/architecture/backend/adr/ADR-003-multi-tenancy.md`
- `docs/architecture/backend/issues/issues_map-COMP.md`
- `docs/architecture/backend/services/comp-service/comp-service-spec.md`
- `docs/architecture/backend/services/comp-service/contracts/api-contract.md`
- `docs/architecture/backend/services/comp-service/contracts/data-model.md`
- `docs/architecture/backend/services/comp-service/contracts/event-contracts.md`
- `docs/architecture/backend/services/comp-service/contracts/integration-contracts.md`
- `docs/architecture/backend/services/comp-service/generator-config.yml`
- `docs/architecture/backend/services/comp-service/spec/backend/SPEC-01..10.md`
- `pnpm test --testPathPattern=comp.e2e`

**Prompt de kick-off:**

```
Você implementa o terminal t2 do split pole-position de COMP.
Branch: stream/comp-t2. Nunca trocar de branch.
Plano-fonte: docs\architecture\backend\plans\plan-COMP.md
Suas unidades: P2, P5, P8.
Toque SOMENTE os arquivos listados acima. Se precisar de um arquivo
de outro terminal, pare e sinalize — não edite fora do seu ownership.
Siga o plano para suas unidades; rode os testes locais antes de marcar pronto.
```

### Terminal t3 — `stream/comp-t3`

**Unidades:** P3, P6

**Arquivos sob sua responsabilidade (não tocar fora desta lista):**

- `CompositionErasurePort.purge`
- `contracts/data-model.md`
- `contracts/integration-contracts.md`

**Prompt de kick-off:**

```
Você implementa o terminal t3 do split pole-position de COMP.
Branch: stream/comp-t3. Nunca trocar de branch.
Plano-fonte: docs\architecture\backend\plans\plan-COMP.md
Suas unidades: P3, P6.
Toque SOMENTE os arquivos listados acima. Se precisar de um arquivo
de outro terminal, pare e sinalize — não edite fora do seu ownership.
Siga o plano para suas unidades; rode os testes locais antes de marcar pronto.
```

## Ordem de merge

Merge em `dev` na ordem dos terminais (t1, t2, ...). Cada um é file-disjunto, então a ordem é livre; conflitos de merge não devem ocorrer por design. Resolva dependências de unidade (ex.: P2 depende de P1) sincronizando via `dev` antes do gate do terminal dependente.

