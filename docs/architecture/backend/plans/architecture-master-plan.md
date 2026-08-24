# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Scaffold | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp-service | OK | OK | OK | OK | OK | 2026-08-24 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp-service | pnpm build | `pnpm --filter @cordele/imp-service build` | DIFERIDO (pnpm ausente no PATH; habilitar via 'corepack enable pnpm') |
| 2026-08-24 | IMP/imp-service | pnpm test | `pnpm --filter @cordele/imp-service test` | DIFERIDO (pnpm ausente no PATH) |
| 2026-08-24 | IMP/imp-service | eslint-plugin-boundaries | `pnpm --filter @cordele/imp-service lint` | DIFERIDO (pnpm ausente no PATH) |

## Log cronologico
