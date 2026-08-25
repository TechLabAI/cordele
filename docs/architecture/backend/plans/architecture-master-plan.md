# Architecture Master Plan

> Rastreia a camada de arquitetura (Layer 1 -- Architect) de cada modulo.
> Atualizado automaticamente (master-plan.py, D-371). NAO editar a mao.

Legenda de status: `pendente` | `em andamento` | `OK` | `bloqueado` | `N/A`

## Status por modulo

| Modulo | Servico | Vision | Specs | Specs-Validate | Backlog | Scaffold | Atualizado |
|---|---|---|---|---|---|---|---|
| IMP | imp-service | OK | OK | OK | OK | OK | 2026-08-24 |
| PROJ | proj-service | OK | OK | OK | OK | OK | 2026-08-25 |
| COMP | comp-service | OK | OK | OK | OK | OK | 2026-08-25 |
| PUB | pub-service | OK | OK | OK | OK | OK | 2026-08-25 |

## Ledger de gates diferidos

| Data | Escopo | Gate | Comando de recuperacao | Status |
|---|---|---|---|---|
| 2026-08-24 | IMP/imp-service | pnpm build | `pnpm --filter @cordele/imp-service build` | OK (D-602) - exit 0; os 9 erros TS foram corrigidos nos geradores |
| 2026-08-24 | IMP/imp-service | pnpm test | `pnpm --filter @cordele/imp-service test` | OK (D-603) - 8 testes do agregado |
| 2026-08-24 | IMP/imp-service | eslintBoundaries | `pnpm --filter @cordele/imp-service lint` | DIFERIDO (pnpm ausente no PATH) |
| 2026-08-24 | IMP/imp-service | prismaValidate | `pnpm --filter @cordele/imp-service exec prisma validate` | OK (schema valido; exige DATABASE_URL no ambiente) |
| 2026-08-24 | IMP/imp-service | eslintBoundaries | `pnpm --filter @cordele/imp-service lint` | OK (D-603) - flat config + fronteiras hexagonais |
| 2026-08-25 | COMP/comp-service | nestVersionDrift | `grep '@nestjs/core' backend/services/*/package.json` | ACHADO (nao-bloqueante) - o scaffold fixa NestJS ^10.4.15 nos 3 servicos (imp/proj/comp) mas project-context.json declara stack.backend.frameworkVersion=11.x; defeito do gerador, nao do modulo |
| 2026-08-25 | PUB/pub-service | nestVersionDrift | `grep '@nestjs/core' backend/services/*/package.json` | ACHADO (nao-bloqueante) - pub-service tambem fixa NestJS ^10.4.15; os 4 servicos divergem de stack.backend.frameworkVersion=11.x (defeito do gerador) |

## Log cronologico
- 2026-08-24T15:41:09 -- IMP -- Toolchain instalado (corepack pnpm 11 + npm install no frontend); os 6 gates deixaram de ser DIFERIDO e correram de verdade. Resultado real: 2 OK (prismaValidate, e2eValidate 27 tests), 4 FAIL. O scaffold NAO compila out of the box - ver Ledger.
- 2026-08-25T03:09:58 -- PROJ -- M1 vision -- OK -- docs 01..06 + ADR-001..003 (status authority em PROJ)
- 2026-08-25T03:09:59 -- PROJ -- M1.5 sync _brief -- OK -- core BE autoritativo replicado no FE, addendum FE preservado; corrigido no BE refs de tela T01->T02 e T07->T08 (verificado contra BA wireframe.md)
- 2026-08-25T03:30:20 -- PROJ -- M2 specs -- OK -- 5 contratos + 11 SPECs + 4 features + C4; barreira api-contract.md verificada (7 endpoints)
- 2026-08-25T08:32:56 -- PROJ -- M3 BE specs-validate -- OK -- Gate1 0 violacoes hard (4 advisory EARS), Gate2 43/43 clausulas testaveis; 8 features / 44 cenarios
- 2026-08-25T08:57:58 -- PROJ -- M4 BE backlog -- OK -- 18 issues funcionais + 6 INT = 24; plan-PROJ.md (P1..P8) + generator-config.yml
- 2026-08-25T09:08:38 -- PROJ -- M5 BE scaffold -- OK -- 42 ficheiros, hexagonal NestJS; gates EXECUTADOS: build OK, test OK (8), lint OK (0 warnings), prisma validate OK; D-607 corrigiu o default do --spec-dir nos geradores entity/migration
- 2026-08-25T10:17:16 -- COMP -- M1 vision -- OK -- docs 01..06 + ADR-001..003 (service boundary, layout overrides, cover storage port); stack node/NestJS confirmada
- 2026-08-25T10:36:55 -- COMP -- M2 specs -- OK -- 5 contratos + 10 SPECs + 6 features + C4; barreira api-contract.md verificada; D-H fecha o conflito BE<->FE (alinhamento de imagem no MVP, blank-page deferido 422)
- 2026-08-25T10:52:15 -- COMP -- M3 BE specs-validate -- OK -- Gate1 0 violacoes hard (4 advisory), Gate2 50/50 clausulas testaveis; 8 features / 44 cenarios + 4 outlines
- 2026-08-25T11:11:41 -- COMP -- M4 BE backlog -- OK -- 20 issues funcionais + 6 INT = 26; plan-COMP.md (P1..P8); A1 multi-tenancy resolvido por precedente (empresaId discriminator, como imp/proj) -- COMP-002 deixa de bloquear o scaffold
- 2026-08-25T11:21:15 -- COMP -- M5 BE scaffold -- OK -- 34 ficheiros, hexagonal NestJS; gates EXECUTADOS: build OK, test OK (8), lint OK (0 warnings), prisma validate OK; COMP-002 fechado (Opcao C empresaId discriminador)
- 2026-08-25T12:55:57 -- PUB -- M1 Vision -- OK -- docs 01..06 + ADR-001..003 (pub-service)
- 2026-08-25T13:12:43 -- PUB -- M2 Specs -- OK -- 24 artefatos; api-contract.md gerado (barreira FE vencida)
- 2026-08-25T13:27:21 -- PUB -- M3 Specs-Validate -- OK -- EARS SPEC-01..11 validado; 4 defeitos de Cucumber Expression corrigidos nos .feature
- 2026-08-25T13:42:20 -- PUB -- M4 Backlog -- OK -- 20 issues PUB-001..020 + 6 INT-PUB-001..006 + issues_map + plan-PUB.md (P1..P9)
- 2026-08-25T13:53:45 -- PUB -- M5 Scaffold -- OK -- 41 arquivos NestJS/Prisma/BDD; gates pnpmBuild+pnpmTest+eslintBoundaries+prismaValidate+bddGateNode todos verdes (eslint e dist/ reverificados pelo orquestrador)
