# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Promote | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp | OK | OK | OK | OK | OK | 2026-08-24 |
| PROJ | proj | OK | OK | OK | OK | OK | 2026-08-25 |
| COMP | comp | OK | OK | OK | OK | OK | 2026-08-25 |
| PUB | pub | OK | OK | OK | OK | OK | 2026-08-25 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp | e2eValidate | `npx nx e2e imp-e2e --list --skipInstall` | OK - 27 tests listados |
| 2026-08-24 | IMP/imp | feChecks | `npx nx run-many -t lint test build -p imp` | OK (D-603) - lint+test+build |
| 2026-08-24 | IMP/imp | e2e specs vazios | `npx nx e2e imp-e2e --list --skipInstall` | RESOLVIDO D-601 - confirmado por execucao real: 27 tests listados (antes 0) |
| 2026-08-25 | COMP/comp | e2eValidate | `npx nx e2e comp-e2e --list --skipInstall` | OK - 22 tests listados em 2 ficheiros |
| 2026-08-25 | COMP/comp | feChecks | `npx nx run-many -t lint test build -p comp` | OK - lint+test+build |
| 2026-08-25 | PUB/pub | shellBuild | `cd frontend && pnpm add -D @angular-devkit/build-angular && npx nx build cordele-web` | DIFERIDO (@angular-devkit/build-angular ausente no node_modules -- gap de ambiente pre-existente, atinge todos os modulos; lib pub compila e empacota OK) |
| 2026-08-25 | PROJ/proj | e2eValidate | `npx nx e2e proj-e2e --list --skipInstall` | OK - 29 tests em 2 ficheiros (auditoria 2026-08-25) |
| 2026-08-25 | PROJ/proj | feChecks | `npx nx run-many -t lint test build -p proj` | OK - lint+test+build (auditoria 2026-08-25) |
| 2026-08-25 | PUB/pub | feChecks | `npx nx run-many -t lint test build -p pub` | OK - lint+test+build (1 no-unused-vars corrigido em publicacao-mock.adapter.ts) |
| 2026-08-25 | PUB/pub | e2eValidate | `npx nx e2e pub-e2e --list --skipInstall` | OK - 26 tests em 2 ficheiros |

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
- 2026-08-25T09:34:24 -- PROJ -- M7 e2e-validate -- OK (pending) -- gate EXECUTADO: nx e2e proj-e2e --list = 29 tests em 2 ficheiros, 0 erros
- 2026-08-25T09:34:24 -- PROJ -- M7 feChecks -- OK -- gate EXECUTADO: nx run-many lint+test+build -p proj verde apos corrigir import nao usado (LibraryStatus) deixado pela promocao
- 2026-08-25T10:17:17 -- COMP -- M1 vision -- OK -- docs 01..06 + ADR-COMP-001; telas T05 configuracoes + T06 editor-de-layout-preview
- 2026-08-25T10:52:16 -- COMP -- M3 FE specs -- OK -- SPEC-01..08 + generator-config + cross-link + design-tokens + 2 features pt; reconciliado com api-contract: rotas :projetoId, preview-context unico, 409 illegal-status vira guard FE-only
- 2026-08-25T11:11:41 -- COMP -- M4 FE specs-validate -- OK -- Gate1 PASS apos dividir 4 clausulas EARS aninhadas (SPEC-03/04); Gate2 44/44 cobertas, 31 cenarios, 14 orphans defensivos
- 2026-08-25T11:32:47 -- COMP -- M5 FE backlog -- OK -- 27 issues funcionais + 6 INT = 33; plan-FE-COMP.md (P1..P9); issues de Promote (D-493), nao de scaffold
- 2026-08-25T14:45:00 -- COMP -- M6 FE promote -- OK -- Track D; 2 ports (MetadadosPort + LayoutPort); 6 adapters (mock+http x2 + guards x2); 2 facades (MetadadosFacade + LayoutFacade); 2 telas promovidas (T05 configuracoes + T06 editor-de-layout-preview); comp.routes.ts; comp.providers.ts; apps/comp-e2e registado (D-487 pattern) 2 features 22 cenarios; gate nx lint+test+build VERDE; gate e2e --list 22 tests 0 erros OK (pending); master-plan Promote=OK
- 2026-08-25T11:49:00 -- COMP -- M6 FE promote -- OK -- 2 ports (Metadados+Layout); 4 adapters (mock+http x2); 2 facades; 2 telas promovidas (T05 configuracoes + T06 editor-de-layout-preview); toolbar estrutural e tipo='em-branco' removidos; tokens --paper-*; guards comp-projeto/comp-status; apps/comp-e2e registado (D-487)
- 2026-08-25T11:49:00 -- COMP -- M7 e2e-validate -- OK (pending) -- gate EXECUTADO: nx e2e comp-e2e --list = 22 tests em 2 ficheiros, 0 erros
- 2026-08-25T11:49:01 -- COMP -- M7 feChecks -- OK -- gate EXECUTADO: nx run-many lint+test+build -p comp verde nos 3 targets
- 2026-08-25T12:55:57 -- PUB -- M1 Vision -- OK -- docs 01..06 + ADR-PUB-001 (libs/pub)
- 2026-08-25T13:27:21 -- PUB -- M3 Specs -- OK -- SPEC-01..08 + generator-config + cross-link + 2 e2e features; M4 Specs-Validate OK (gate fe-ears-coverage 42/42, exit 0, verificado inline)
- 2026-08-25T00:00:00 -- PUB -- M6 Promote -- OK -- Track D: 15 arquivos em libs/pub/; T07+T08 promovidos; setInterval/AVISOS_MOCK/seletor removidos; bounded poll; signed-URL download; podeBaixar computed; KPI tiles omitidos (INT-FE-PUB-005); apps/pub-e2e registrado (D-487); tsc clean; pub-e2e --list 26 tests OK (pending)
- 2026-08-25T14:26:45 -- PUB -- M6 Promote -- OK -- T07+T08 promovidos p/ libs/pub (setInterval/AVISOS_MOCK/'Simular estado'/barra % removidos); Port+2 adapters+2 facades; apps/pub-e2e registrado (D-487)
- 2026-08-25T14:26:45 -- PUB -- M7 E2E-Validate -- OK (pending) -- nx e2e pub-e2e --list: 26 tests/2 files, exit 0 | feChecks OK (lint+test+build da lib verdes; 1 no-unused-vars corrigido em publicacao-mock.adapter.ts) | shellBuild DIFERIDO (ver Ledger)
