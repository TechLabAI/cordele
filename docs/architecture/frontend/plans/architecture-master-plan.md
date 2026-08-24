# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Promote | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp | OK | OK | OK | OK | OK | 2026-08-24 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp | e2eValidate | `npx nx e2e imp-e2e --list --skipInstall` | OK - 27 tests em 2 ficheiros, exit 0 (exigiu .nxignore com design-reference/) |
| 2026-08-24 | IMP/imp | feChecks | `npx nx run-many -t lint test build -p imp` | FAIL - libs/imp/.eslintrc.json estende ../../.eslintrc.json que nao existe na raiz do frontend; imp:test tambem falha |
| 2026-08-24 | IMP/imp | e2e specs vazios | `npx nx e2e imp-e2e --list --skipInstall` | RESOLVIDO D-601 - confirmado por execucao real: 27 tests listados (antes 0) |

## Log cronologico
- 2026-08-24T15:14:30 -- IMP -- M7 e2e-validate -- DIFERIDO -- pre-requisitos e correspondencia .feature<->.spec OK; gate nao executado (nx ausente). BLOQUEANTE: os 2 specs sao stubs com 0 test() -- 27 cenarios pt nao parseados (parser so casa Gherkin en). Nao registrado como coluna: E2E-Validate nao existe em _STATUS_STEPS nem no cabecalho canonico FE.
- 2026-08-24T15:24:33 -- IMP -- D-601 -- parser Gherkin pt corrigido; specs e2e regenerados (16+11 test.skip); o gate e2e deixa de ser verde sobre nada
- 2026-08-24T15:41:09 -- IMP -- Toolchain instalado (corepack pnpm 11 + npm install no frontend); os 6 gates deixaram de ser DIFERIDO e correram de verdade. Resultado real: 2 OK (prismaValidate, e2eValidate 27 tests), 4 FAIL. O scaffold NAO compila out of the box - ver Ledger.
