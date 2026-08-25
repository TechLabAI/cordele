# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Promote | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp | OK | OK | OK | OK | OK | 2026-08-24 |
| PROJ | proj | OK | OK | OK | OK | OK | 2026-08-25 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp | e2eValidate | `npx nx e2e imp-e2e --list --skipInstall` | OK - 27 tests listados |
| 2026-08-24 | IMP/imp | feChecks | `npx nx run-many -t lint test build -p imp` | OK (D-603) - lint+test+build |
| 2026-08-24 | IMP/imp | e2e specs vazios | `npx nx e2e imp-e2e --list --skipInstall` | RESOLVIDO D-601 - confirmado por execucao real: 27 tests listados (antes 0) |

## Log cronologico
- 2026-08-24T15:14:30 -- IMP -- M7 e2e-validate -- DIFERIDO -- pre-requisitos e correspondencia .feature<->.spec OK; gate nao executado (nx ausente). BLOQUEANTE: os 2 specs sao stubs com 0 test() -- 27 cenarios pt nao parseados (parser so casa Gherkin en). Nao registrado como coluna: E2E-Validate nao existe em _STATUS_STEPS nem no cabecalho canonico FE.
- 2026-08-24T15:24:33 -- IMP -- D-601 -- parser Gherkin pt corrigido; specs e2e regenerados (16+11 test.skip); o gate e2e deixa de ser verde sobre nada
- 2026-08-24T15:41:09 -- IMP -- Toolchain instalado (corepack pnpm 11 + npm install no frontend); os 6 gates deixaram de ser DIFERIDO e correram de verdade. Resultado real: 2 OK (prismaValidate, e2eValidate 27 tests), 4 FAIL. O scaffold NAO compila out of the box - ver Ledger.
- 2026-08-25T03:09:59 -- PROJ -- M1 vision -- OK -- docs 01..06 + ADR-PROJ-001; telas T02 biblioteca-de-projetos + T08 download-e-historico
- 2026-08-25T08:37:48 -- PROJ -- M3 FE specs -- OK -- SPEC-01..08 + generator-config + cross-link + design-tokens + 2 features pt; reconciliacao contra api-contract: 3 divergencias do doc 05 corrigidas, ADR-PROJ-001 confirmado (api-contract 8.4)
- 2026-08-25T08:37:48 -- IMP -- fix -- generator-config.yml backend_contract apontava 4 niveis acima e nao resolvia; corrigido para 5 (detectado ao comparar com PROJ no M3)
- 2026-08-25T08:44:00 -- PROJ -- M4 FE specs-validate -- OK -- Gate1 0 violacoes / 7 SPECs / 40 clausulas EARS; Gate2 40/40 cobertas (29 cenarios, 15 orfaos defensivos); # language: pt confirmado nos 2 features
- 2026-08-25T09:19:41 -- PROJ -- M5 FE backlog -- OK -- 26 issues funcionais + 6 INT = 32; plan-FE-PROJ.md; issues de Promote (D-493), nao de scaffold
- 2026-08-25T00:00:00 -- PROJ -- M6 FE promote -- OK -- Track D; 2 ports (ProjetoPort + PublicacaoPort); 4 adapters (mock+http x2); 2 facades (LibraryFacade + HistoryFacade); 2 telas promovidas (T02 + T08); proj.routes.ts; proj.providers.ts; apps/proj-e2e registado (D-487) 2 features 29 cenarios; master-plan Promote=OK
