# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Scaffold | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp-service | OK | OK | OK | OK | OK | 2026-08-24 |
| PROJ | proj-service | OK | OK | OK | OK | OK | 2026-08-25 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp-service | pnpm build | `pnpm --filter @cordele/imp-service build` | OK (D-602) - exit 0; os 9 erros TS foram corrigidos nos geradores |
| 2026-08-24 | IMP/imp-service | pnpm test | `pnpm --filter @cordele/imp-service test` | OK (D-603) - 8 testes do agregado |
| 2026-08-24 | IMP/imp-service | eslintBoundaries | `pnpm --filter @cordele/imp-service lint` | DIFERIDO (pnpm ausente no PATH) |
| 2026-08-24 | IMP/imp-service | prismaValidate | `pnpm --filter @cordele/imp-service exec prisma validate` | OK (schema valido; exige DATABASE_URL no ambiente) |
| 2026-08-24 | IMP/imp-service | eslintBoundaries | `pnpm --filter @cordele/imp-service lint` | OK (D-603) - flat config + fronteiras hexagonais |

## Log cronologico
- 2026-08-24T15:41:09 -- IMP -- Toolchain instalado (corepack pnpm 11 + npm install no frontend); os 6 gates deixaram de ser DIFERIDO e correram de verdade. Resultado real: 2 OK (prismaValidate, e2eValidate 27 tests), 4 FAIL. O scaffold NAO compila out of the box - ver Ledger.
- 2026-08-25T03:09:58 -- PROJ -- M1 vision -- OK -- docs 01..06 + ADR-001..003 (status authority em PROJ)
- 2026-08-25T03:09:59 -- PROJ -- M1.5 sync _brief -- OK -- core BE autoritativo replicado no FE, addendum FE preservado; corrigido no BE refs de tela T01->T02 e T07->T08 (verificado contra BA wireframe.md)
- 2026-08-25T03:30:20 -- PROJ -- M2 specs -- OK -- 5 contratos + 11 SPECs + 4 features + C4; barreira api-contract.md verificada (7 endpoints)
- 2026-08-25T08:32:56 -- PROJ -- M3 BE specs-validate -- OK -- Gate1 0 violacoes hard (4 advisory EARS), Gate2 43/43 clausulas testaveis; 8 features / 44 cenarios
- 2026-08-25T08:57:58 -- PROJ -- M4 BE backlog -- OK -- 18 issues funcionais + 6 INT = 24; plan-PROJ.md (P1..P8) + generator-config.yml
- 2026-08-25T09:08:38 -- PROJ -- M5 BE scaffold -- OK -- 42 ficheiros, hexagonal NestJS; gates EXECUTADOS: build OK, test OK (8), lint OK (0 warnings), prisma validate OK; D-607 corrigiu o default do --spec-dir nos geradores entity/migration
