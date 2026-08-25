# SPEC-02 — Project Lifecycle & Status Authority (core orchestration)

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §7, `contracts/integration-contracts.md` §1.3–1.4,
local `adr/ADR-002-project-status-authority.md`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Especificar a **autoridade de status** do projeto: a tabela de transições legais, a semântica de
idempotência, o erro de transição ilegal, e a separação entre `advanceTo` (avanço/lateral, idempotente,
para IMP/PUB) e `reopen` (a única aresta de regressão deliberada, para o editor — gap G6).

## Escopo

- **In:** `AdvanceProjetoStatusUseCase.advanceTo`, `ReopenProjectForRevisionUseCase.reopen`, o VO
  `ProjectStatus` (tabela de transições), emissão de `ProjectStatusChanged`, auditoria em
  `projeto_status_historico`.
- **Out:** o que dispara a transição (IMP confirm-estrutura; PUB export) — vive nos respetivos contextos.

## Decisões técnicas

- As regras de transição vivem no **value object `ProjectStatus`** (domínio puro); nenhum controller/
  adapter as re-codifica (doc 04). Único escritor de `status`: PROJ (ADR-002, R1).
- `advanceTo` é idempotente e **nunca regride**; a regressão `publicado|com_erros → em_composicao` é
  `reopen` (D-D). Isto resolve o conflito entre "IMP re-confirma (no-op)" e "editor abre nova revisão".

## Implementação — `advanceTo({ projetoId, targetStatus })`

```
1. carregar projeto no EmpresaContext do chamador; ausente → NotFound.
2. current = projeto.status
3. se targetStatus == current                                   → no-op (changed=false), sem evento
4. se targetStatus == 'em_composicao' e current ∈ {publicado, com_erros} → no-op (não regride), sem evento
5. se (current, targetStatus) ∈ tabela legal                    → aplicar, persistir, append histórico,
                                                                    emitir ProjectStatusChanged (changed=true)
6. senão                                                         → throw IllegalStatusTransitionError
```

Tabela legal (api-contract §7): `rascunho→em_composicao`; `em_composicao→publicado|com_erros`;
`publicado↔com_erros`; (regressão só via `reopen`): `publicado|com_erros→em_composicao`.

## Implementação — `reopen({ projetoId })`

`publicado|com_erros → em_composicao`; no-op idempotente se já `em_composicao`; rejeita de `rascunho`.

## Casos de borda

- IMP re-chama `advanceTo(em_composicao)` num projeto já `publicado` → no-op (não regride) — casa com
  imp api-contract §8.2.
- PUB re-exporta: `com_erros → publicado` e `publicado → com_erros` são mudanças reais (emitem evento).
- `rascunho → publicado` (pular composição) → `IllegalStatusTransitionError` (409 no REST).
- `targetStatus` inválido → 400 `urn:cordele:proj:validation`.
- Qualquer transição para `rascunho` → ilegal (estado só-inicial).

## Critérios de aceite (EARS)

- `WHEN advanceTo targets a legal status different from the current one, THE SYSTEM SHALL apply it, append
  a projeto_status_historico row, emit ProjectStatusChanged, and return changed=true.`
- `IF targetStatus equals the current status, THEN THE SYSTEM SHALL return changed=false and emit no event.`
- `IF advanceTo targets em_composicao WHILE the project is publicado or com_erros, THEN THE SYSTEM SHALL
  return changed=false and never regress.`
- `IF advanceTo targets publicado or com_erros WHILE the project is rascunho, THEN THE SYSTEM SHALL throw
  IllegalStatusTransitionError.`
- `WHEN reopen is called on a publicado or com_erros project, THE SYSTEM SHALL set em_composicao and emit
  ProjectStatusChanged; IF the project is rascunho, THEN THE SYSTEM SHALL reject.`
- `THE SYSTEM SHALL be the sole writer of projeto_editorial.status.`
