# Issues Map — FE PROJ (Projetos) — Cordelê Frontend

> Gerado por `/fe-architect-backlog cordele PROJ` — M5 autopilot.
> Trace: `tr_f2cd686cfce8`

## Totais

- **Funcionais:** 26 issues (FE-PROJ-001..026)
- **Integração:** 6 issues (INT-FE-PROJ-001..006)
- **Total:** 32 issues

---

## Por Prioridade (Ondas P1-P9)

| Onda | Foco | Issues | Qtd | Estimativa |
|---|---|---|---|---|
| **P1 — Foundation** | Contrato + routes + lifecycle + shell | FE-PROJ-001..006 | 6 | 3 dias |
| **P2 — Data Access** | API Service + DTOs + facades + navegação | FE-PROJ-007..011 | 5 | 5 dias |
| **P3 — Feature Libs** | Promote T02 + T08 + componentes UI | FE-PROJ-012..016 | 5 | 7 dias |
| **P4 — Guards + INT** | Guards + wiring permissão + integrações | FE-PROJ-017..018 + INT-FE-PROJ-001..006 | 8 | 5 dias |
| **P5 — UX Polish** | Skeletons + error states + degradação | FE-PROJ-019..021 | 3 | 3 dias |
| **P6 — LGPD** | Capacidade data-access sem UI | FE-PROJ-022 | 1 | 0.5 dia |
| **P7 — Observability** | Telemetria lifecycle | FE-PROJ-023 | 1 | 0.5 dia |
| **P8 — e2e** | Playwright T02 + T08 | FE-PROJ-024..025 | 2 | 4 dias |
| **P9 — Informational** | Documentação cenários órfãos | FE-PROJ-026 | 1 | — |

**Estimativa total:** ~28 dias dev (1 desenvolvedor) · ~16 dias com 2 devs em paralelo (P2-P3 parcialmente paralelos)

---

## Por SPEC de origem

| SPEC | Issues alimentadas |
|---|---|
| SPEC-01 (Route Map) | FE-PROJ-002, FE-PROJ-005, FE-PROJ-011, FE-PROJ-017, INT-FE-PROJ-003, INT-FE-PROJ-004, INT-FE-PROJ-006 |
| SPEC-02 (Component Hierarchy) | FE-PROJ-012, FE-PROJ-013, FE-PROJ-014, FE-PROJ-015, FE-PROJ-019 |
| SPEC-03 (View Models) | FE-PROJ-008, FE-PROJ-009, FE-PROJ-010, FE-PROJ-013, FE-PROJ-021 |
| SPEC-04 (Data Access) | FE-PROJ-007, FE-PROJ-008, FE-PROJ-009, FE-PROJ-010, FE-PROJ-016, FE-PROJ-022, INT-FE-PROJ-005 |
| SPEC-05 (Module Contract) | FE-PROJ-001, FE-PROJ-004, FE-PROJ-018 |
| SPEC-06 (Shell Integration) | FE-PROJ-003, FE-PROJ-004, FE-PROJ-005, FE-PROJ-006, FE-PROJ-023 |
| SPEC-07 (Error Handling) | FE-PROJ-008, FE-PROJ-010, FE-PROJ-019, FE-PROJ-020, FE-PROJ-021, INT-FE-PROJ-001 |
| SPEC-08 (e2e Scenarios) | FE-PROJ-024, FE-PROJ-025, FE-PROJ-026 |
| generator-config.yml | FE-PROJ-001..006 (foundation) |

---

## Por Camada (Hexagonal-FE)

| Camada | Path | Issues |
|---|---|---|
| **Shell entry / Contrato** | `libs/proj/shell-entry` | FE-PROJ-001, FE-PROJ-002, FE-PROJ-003, FE-PROJ-004 |
| **Shell integration** | `apps/cordele-web` + `libs/proj/integration` | FE-PROJ-005, FE-PROJ-006, FE-PROJ-023 |
| **Access guards** | `libs/proj/access` | FE-PROJ-017 |
| **Data access** | `libs/proj/data-access` | FE-PROJ-007, FE-PROJ-008, FE-PROJ-009, FE-PROJ-010, FE-PROJ-016, FE-PROJ-022 |
| **Navigation** | `libs/proj/navigation` | FE-PROJ-011 |
| **Feature library (T02)** | `libs/proj/feature-library` | FE-PROJ-012, FE-PROJ-018 |
| **Feature history (T08)** | `libs/proj/feature-history` | FE-PROJ-014, FE-PROJ-018 |
| **UI local** | `libs/proj/ui` | FE-PROJ-013, FE-PROJ-015, FE-PROJ-019 |
| **UX Polish** | feature-library + feature-history | FE-PROJ-020, FE-PROJ-021 |
| **e2e** | `apps/proj-e2e` | FE-PROJ-024, FE-PROJ-025 |
| **INT — shared** | cross-cutting | INT-FE-PROJ-001, INT-FE-PROJ-002 |
| **INT — IMP** | proj → imp | INT-FE-PROJ-003 |
| **INT — COMP** | proj → comp | INT-FE-PROJ-004 |
| **INT — PUB** | proj ← pub | INT-FE-PROJ-005, INT-FE-PROJ-006 |
| **Informacional** | docs | FE-PROJ-026 |

---

## Dependências Críticas (Caminho Mais Longo)

```
FE-PROJ-001 (contrato)
  └─► FE-PROJ-002 (routes)
        └─► FE-PROJ-007 (ProjetoApiService)
              └─► FE-PROJ-008 (DTOs + mappers)
                    ├─► FE-PROJ-009 (LibraryFacade)
                    │     └─► FE-PROJ-012 (T02 Promote)
                    │           └─► FE-PROJ-018 (permission wiring)
                    │                 └─► FE-PROJ-024 (e2e T02)
                    │
                    └─► FE-PROJ-010 (HistoryFacade) ◄── FE-PROJ-011 (navegação)
                          └─► FE-PROJ-014 (T08 Promote)
                                └─► FE-PROJ-015 (history list)
                                      └─► FE-PROJ-025 (e2e T08)

FE-PROJ-005 (ProjShellIntegrationService) → FE-PROJ-003 (bootstrap) → FE-PROJ-006 (shell reg.)

INT-FE-PROJ-001 (interceptors) → FE-PROJ-020 (error states com correlationId)
FE-PROJ-021 (degradação) → INT-FE-PROJ-005 (fixture degradada) → FE-PROJ-025 (e2e T08 degraded)
```

**Caminho crítico (9 níveis):** 001 → 002 → 007 → 008 → 010 → 014 → 015 → 025

---

## Estimativas por Tamanho

| Tamanho | Issues | Qtd |
|---|---|---|
| **S** (< 0.5 dia) | FE-PROJ-022, FE-PROJ-023, FE-PROJ-026, INT-FE-PROJ-003, INT-FE-PROJ-006 | 5 |
| **M** (0.5-1 dia) | FE-PROJ-001, FE-PROJ-002, FE-PROJ-003, FE-PROJ-004, FE-PROJ-006, FE-PROJ-008, FE-PROJ-011, FE-PROJ-016, FE-PROJ-017, FE-PROJ-018, FE-PROJ-019, FE-PROJ-021, INT-FE-PROJ-001, INT-FE-PROJ-002, INT-FE-PROJ-004, INT-FE-PROJ-005 | 16 |
| **L** (1-2 dias) | FE-PROJ-005, FE-PROJ-007, FE-PROJ-009, FE-PROJ-010, FE-PROJ-012, FE-PROJ-013, FE-PROJ-014, FE-PROJ-015, FE-PROJ-020, FE-PROJ-024, FE-PROJ-025 | 11 |

---

## Índice Completo

### Issues Funcionais (FE-PROJ-001..026)

| # | Issue | Camada | Onda | Tamanho |
|---|---|---|---|---|
| FE-PROJ-001 | Module contract — proj.contract.ts, permission-map, feature-flags | shell-entry | P1 | M |
| FE-PROJ-002 | Module routes — proj.routes.ts, lazy loading | shell-entry | P1 | M |
| FE-PROJ-003 | Module lifecycle — proj.module.ts, proj.bootstrap.ts | shell-entry | P1 | M |
| FE-PROJ-004 | Module descriptor — PROJ_MODULE_DESCRIPTOR | shell-entry | P1 | M |
| FE-PROJ-005 | Shell integration service — ProjShellIntegrationService | integration | P1 | L |
| FE-PROJ-006 | Shell registration — module-descriptors.ts, home redirect | shell (app) | P1 | M |
| FE-PROJ-007 | ProjetoApiService — 7 endpoints | data-access | P2 | L |
| FE-PROJ-008 | DTOs + mapeamento ProblemDetail→AppError | data-access | P2 | M |
| FE-PROJ-009 | LibraryFacade — signals, state machine, empresa-switch | data-access | P2 | L |
| FE-PROJ-010 | HistoryFacade — forkJoin, reopen pessimista, 409 defensivo | data-access | P2 | L |
| FE-PROJ-011 | ProjetoNavigationService — resolver stage-aware, breadcrumbs | navigation | P2 | M |
| FE-PROJ-012 | Promote T02 → feature-library + LibraryHeader + EmptyLibrary | feature-library | P3 | L |
| FE-PROJ-013 | ProjectCardComponent + StatusBadgeComponent — badge derivation | ui | P3 | L |
| FE-PROJ-014 | Promote T08 → feature-history + ProjectHeaderComponent + reopen CTAs | feature-history | P3 | L |
| FE-PROJ-015 | PublicationHistoryListComponent + PublicationHistoryRowComponent | ui | P3 | L |
| FE-PROJ-016 | Download por URL assinada — resolveDownloadUrl, window.open | data-access + features | P3 | M |
| FE-PROJ-017 | projProjetoGuard — UUID validation + resolvability | access | P4 | M |
| FE-PROJ-018 | Permission affordance wiring — proj.download + proj.reopen | feature-library + history | P4 | M |
| FE-PROJ-019 | Loading skeletons — LibrarySkeleton + HistorySkeleton (CLS-safe) | ui | P5 | M |
| FE-PROJ-020 | Error states + URN→UI mapping + retry | feature-library + history | P5 | L |
| FE-PROJ-021 | Degradação parcial — degraded:true rendering, nunca vira error | ui + features | P5 | M |
| FE-PROJ-022 | Capacidade data-access LGPD — deleteProjeto sem UI (LGPD erasure) | data-access | P6 | S |
| FE-PROJ-023 | Telemetria — lifecycle events via @cordele/shared/observability | integration | P7 | S |
| FE-PROJ-024 | Playwright e2e — biblioteca-de-projetos.feature (T02, 14 cenários) | e2e | P8 | L |
| FE-PROJ-025 | Playwright e2e — download-e-historico.feature (T08, 15 cenários) | e2e | P8 | L |
| FE-PROJ-026 | [INFORMACIONAL] 15 cenários e2e órfãos — cobertura defensiva extra | docs | P9 | S |

### Issues de Integração (INT-FE-PROJ-001..006)

| # | Issue | Cross-cutting | Onda |
|---|---|---|---|
| INT-FE-PROJ-001 | @cordele/shared/access-http-base — interceptors, ErrorNormalize | shared | P4 |
| INT-FE-PROJ-002 | @cordele/shared/empresa-context — authGuard + empresaGuard | shared | P4 |
| INT-FE-PROJ-003 | PROJ→IMP — handoff pós-reopen, /imp/upload | cross-module | P4 |
| INT-FE-PROJ-004 | PROJ→COMP — handoff pós-reopen, /comp/config \| /comp/editor | cross-module | P4 |
| INT-FE-PROJ-005 | PROJ←PUB — PublicationHistoryPort degradation | cross-module | P4 |
| INT-FE-PROJ-006 | PROJ←→PUB — nova exportação handoff, /pub/exportacao | cross-module | P4 |
