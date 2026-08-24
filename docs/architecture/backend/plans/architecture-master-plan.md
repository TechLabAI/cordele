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
| 2026-08-24 | IMP/imp-service | pnpm build | `pnpm --filter @cordele/imp-service build` | FAIL - 9 erros TS. 6 sao tenantId vs empresaId (o modelo Prisma gerado usa empresaId, o repositorio/mapper gerados usam tenantId); 2 sao campo status ausente no modelo placeholder Imp; 1 e TS4114 override no jwt-auth.guard |
| 2026-08-24 | IMP/imp-service | pnpm test | `pnpm --filter @cordele/imp-service test` | FAIL - jest nao encontra testes (testRegex .*\.spec\.ts$, 0 matches em 20 ficheiros) |
| 2026-08-24 | IMP/imp-service | eslint-plugin-boundaries | `pnpm --filter @cordele/imp-service lint` | DIFERIDO (pnpm ausente no PATH) |
| 2026-08-24 | IMP/imp-service | prismaValidate | `pnpm --filter @cordele/imp-service exec prisma validate` | OK (schema valido; exige DATABASE_URL no ambiente) |
| 2026-08-24 | IMP/imp-service | eslintBoundaries | `pnpm --filter @cordele/imp-service lint` | FAIL exit 2 - config eslint legada (.eslintrc) incompativel com o eslint instalado |

## Log cronologico
- 2026-08-24T15:41:09 -- IMP -- Toolchain instalado (corepack pnpm 11 + npm install no frontend); os 6 gates deixaram de ser DIFERIDO e correram de verdade. Resultado real: 2 OK (prismaValidate, e2eValidate 27 tests), 4 FAIL. O scaffold NAO compila out of the box - ver Ledger.
