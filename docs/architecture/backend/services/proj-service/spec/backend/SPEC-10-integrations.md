# SPEC-10 — Integrations

**Module:** PROJ · **Refs:** `contracts/integration-contracts.md`, `contracts/hub-integration.md`,
shared `adr/ADR-001-hexagonal-node.md`. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Especificar as integrações de PROJ — todas **in-process cross-context** (não há API externa, broker, AI
nem hub) — atrás de portas de domínio (hexagonal).

## Escopo

- **In:** portas inbound exportadas (IMP/PUB/editor chamam); portas outbound de leitura (IMP/COMP/PUB);
  portas outbound de erasure (IMP/COMP/PUB).
- **Out:** qualquer sistema externo (não há); hub/AI (não aplicável — `hub-integration.md`).

## Decisões técnicas

- Cada integração é um **adapter de infraestrutura atrás de uma porta de domínio**; domínio/aplicação
  nunca nomeiam IMP/COMP/PUB.
- Leituras cross-context **batched por conjunto de projetoIds** (sem N+1, SPEC-03).
- Erasure orquestrada leaf-first e idempotente (SPEC-11).

## Implementação

Contratos completos (signatures, semântica, fallback) em `contracts/integration-contracts.md`:
inbound §1, leitura §2, erasure §3, resumo §4.

| Integração | Direção | Porta | Fallback |
|---|---|---|---|
| Create/validate/advance/reopen | inbound | ver §1 | throw em ilegal / reject |
| Manuscript summary | outbound leitura | `ManuscriptSummaryPort` (IMP) | degrade (counts=0) |
| Project metadata | outbound leitura | `ProjectMetadataPort` (COMP) | degrade (autor=null) |
| Publication history + signed URL | outbound leitura | `PublicationHistoryPort` (PUB) | degrade (history=[]) |
| Erasure pub/comp/imp | outbound erasure | `*ErasurePort` | abort delete (502) |

## Casos de borda

- Porta de leitura fora → degrada. Porta de erasure fora → aborta a deleção (502), projeto recuperável.
- PROJ scaffolded antes de COMP/PUB → stubs (leitura vazia, purge no-op idempotente) para compilar.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL implement every cross-context integration as an infrastructure adapter behind a domain port.`
- `THE SYSTEM SHALL never read or write another context's tables directly.`
- `WHEN composing the library, THE SYSTEM SHALL batch cross-context reads by projetoId set (no N+1).`
- `IF an erasure port fails, THEN THE SYSTEM SHALL abort the deletion before removing the identity row.`
