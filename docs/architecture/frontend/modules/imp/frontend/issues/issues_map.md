# IMP — FE Backlog Index (issues_map.md)

> Cordelê · módulo `imp` · prefixo `IMP` · app `cordele-web` · scope `@cordele`
> Gerado por `/fe-architect-backlog cordele IMP` (M5 autopilot D-452).
> Addendum M4 incluído: endpoints ignore/confirm (`api-contract §8`) refletidos nas issues.

---

## Resumo de contagem

| Categoria | Quantidade |
|---|---|
| Issues funcionais (FE-IMP-NNN) | 25 |
| Issues de integração (INT-FE-IMP-NNN) | 6 |
| **Total** | **31** |

---

## Por prioridade (Ondas P1-P9)

| Onda | Issues | Foco |
|---|---|---|
| **P1 — Foundation** | FE-IMP-001..005 | Module contract, routes, bootstrap, descriptor, shell registration |
| **P2 — Data Access** | FE-IMP-006..011 | DTOs, ManuscriptApiService (upload+read+addendum), ImportFacade, ReviewFacade |
| **P3 — Feature Libs** | FE-IMP-012..018 | Componentes T03 e T04, StepBar, NavConfig |
| **P4 — Hub Integrations** | INT-FE-IMP-001..006 | access-http-base, PROJ in-process, handoff COMP, AccessDecision, EmpresaContext, NavigationService |
| **P5 — Access Guards** | FE-IMP-019 | impProjetoGuard |
| **P6 — Navigation** | FE-IMP-020 | Breadcrumb dinâmico |
| **P7 — UX Polish** | FE-IMP-021..022 | Error mapping SPEC-07, loading states/skeletons |
| **P8 — Observability** | FE-IMP-023 | Telemetria — import lifecycle events |
| **P9 — e2e + Hardening** | FE-IMP-024..025 | Playwright upload (9) + revisão (9) |

---

## Por SPEC de origem

| SPEC | Issues alimentadas |
|---|---|
| SPEC-01 (Route Map) | FE-IMP-002, FE-IMP-019, FE-IMP-020, INT-FE-IMP-003 |
| SPEC-02 (Component Hierarchy) | FE-IMP-012..018 |
| SPEC-03 (View Models) | FE-IMP-010, FE-IMP-011, FE-IMP-014, FE-IMP-015, FE-IMP-022 |
| SPEC-04 (Data Access) | FE-IMP-006..011, INT-FE-IMP-005 |
| SPEC-05 (Module Contract) | FE-IMP-001, FE-IMP-004, INT-FE-IMP-004 |
| SPEC-06 (Shell Integration) | FE-IMP-003, FE-IMP-005, FE-IMP-018, INT-FE-IMP-005, INT-FE-IMP-006 |
| SPEC-07 (Error Handling) | FE-IMP-021, FE-IMP-022, INT-FE-IMP-001 |
| SPEC-08 (E2E Scenarios) | FE-IMP-024, FE-IMP-025 |
| api-contract §8 (Addendum M4) | FE-IMP-009, FE-IMP-011, FE-IMP-025, INT-FE-IMP-003 |

---

## Por camada hexagonal-FE

| Camada | Issues |
|---|---|
| `libs/imp/shell-entry` (app entry) | FE-IMP-001, FE-IMP-002, FE-IMP-003, FE-IMP-004 |
| `apps/cordele-web/shell` (shell config) | FE-IMP-005 |
| `libs/imp/data-access` | FE-IMP-006, FE-IMP-007, FE-IMP-008, FE-IMP-009, FE-IMP-010, FE-IMP-011, FE-IMP-021 |
| `libs/imp/feature-upload` | FE-IMP-012, FE-IMP-013 |
| `libs/imp/feature-review` | FE-IMP-014, FE-IMP-015, FE-IMP-016, FE-IMP-017, FE-IMP-022 |
| `libs/imp/navigation` | FE-IMP-018, FE-IMP-020 |
| `libs/imp/access` | FE-IMP-019 |
| `libs/imp/integration` | FE-IMP-023, INT-FE-IMP-005, INT-FE-IMP-006 |
| `apps/imp-e2e` | FE-IMP-024, FE-IMP-025 |
| cross-cutting / shared | INT-FE-IMP-001, INT-FE-IMP-002, INT-FE-IMP-003, INT-FE-IMP-004 |

---

## Dependências críticas (caminho mais longo)

```
FE-IMP-001 (contract)
  └─ FE-IMP-002 (routes)
       └─ FE-IMP-003 (bootstrap)
            └─ FE-IMP-004 (descriptor)
                 └─ FE-IMP-005 (shell registration)

FE-IMP-006 (DTOs)
  ├─ FE-IMP-007 (upload API)
  │    └─ FE-IMP-009 (addendum API: ignore/confirm)
  │         └─ FE-IMP-011 (ReviewFacade — rollback real)
  │               └─ FE-IMP-017 (RevisaoDeEstruturaComponent)
  │                     └─ FE-IMP-025 (e2e revisão)
  └─ FE-IMP-010 (ImportFacade)
        └─ FE-IMP-013 (UploadComponent)
              └─ FE-IMP-024 (e2e upload)

FE-IMP-014 + FE-IMP-015 + FE-IMP-016 + FE-IMP-018 ──> FE-IMP-017
```

**Caminho crítico:** FE-IMP-001 → 006 → 007 → 009 → 011 → 017 → 025 (8 níveis)

---

## Estimativas por issue (S=meio dia, M=1 dia, L=2 dias)

| Issue | Tamanho | Justificativa |
|---|---|---|
| FE-IMP-001 | S | Constantes TypeScript puras |
| FE-IMP-002 | S | Configuração de rotas |
| FE-IMP-003 | S | Bootstrap simples |
| FE-IMP-004 | S | Descriptor object |
| FE-IMP-005 | S | Edição de arquivo de configuração |
| FE-IMP-006 | S | Interfaces TypeScript (sem lógica) |
| FE-IMP-007 | M | Upload multipart com progress events |
| FE-IMP-008 | S | 3 GETs simples |
| FE-IMP-009 | M | 4 endpoints addendum + testes |
| FE-IMP-010 | M | State machine com signals |
| FE-IMP-011 | L | State machine + rollback + forkJoin |
| FE-IMP-012 | M | 2 componentes presentacionais + validação |
| FE-IMP-013 | M | Smart component + 2 presentacionais |
| FE-IMP-014 | M | 3 componentes presentacionais + skeleton |
| FE-IMP-015 | M | 3 componentes + ReasonLabelPipe |
| FE-IMP-016 | M | ActionBar + modal de confirmação |
| FE-IMP-017 | M | Smart component + integração de signals |
| FE-IMP-018 | S | StepBar + NavConfig |
| FE-IMP-019 | S | Guard de UUID |
| FE-IMP-020 | S | Breadcrumb dinâmico |
| FE-IMP-021 | S | Mapper de erros + testes paramétricos |
| FE-IMP-022 | S | Skeleton states + ajustes |
| FE-IMP-023 | S | Telemetria via integration service |
| FE-IMP-024 | M | 9 cenários Playwright + Page Objects |
| FE-IMP-025 | M | 9 cenários Playwright + Page Objects |
| INT-FE-IMP-001 | S | Verificação de providers + testes de headers |
| INT-FE-IMP-002 | S | Verificação de projetoId flow |
| INT-FE-IMP-003 | S | Navigate após confirm |
| INT-FE-IMP-004 | S | Verificação de AccessDecisionService calls |
| INT-FE-IMP-005 | M | EmpresaContext + takeUntil + testes |
| INT-FE-IMP-006 | S | NavigationService register/unregister |

**Estimativa total:** ~19 dias de trabalho (1 dev; ondas P1-P3 paralelizáveis entre frontend devs)

---

## Delta do Addendum M4 (issues impactadas)

| Impact | Issue | Descrição |
|---|---|---|
| NOVA issue | FE-IMP-009 | ManuscriptApiService — 4 endpoints do addendum |
| MODIFICADA | FE-IMP-011 | ReviewFacade — rollback **obrigatório** (não mais condicional) + confirmEstrutura via API |
| MODIFICADA | FE-IMP-017 | RevisaoDeEstruturaComponent — confirm chama API antes de navegar |
| MODIFICADA | FE-IMP-025 | e2e revisão — cenário de rollback de ignore + confirm API mock |
| MODIFICADA | INT-FE-IMP-003 | Handoff COMP — só após 200 do confirm-estrutura |

---

## Notas de arquitetura

- **Prototype-first (D-493):** `UploadComponent` e `RevisaoDeEstruturaComponent` são promovidos do
  protótipo BA (`frontend/design-reference/angular-prototype/`). O scaffold (M6) os move para
  `libs/imp/feature-upload` e `libs/imp/feature-review`, desconectando mocks e conectando facades.
- **Signals-first:** nenhuma issue usa NgRx; estado via `signal()` + `computed()` + `effect()`.
- **IMP não é polling:** ADR-IMP-001 é inviolável. Qualquer issue que introduzir polling deve ser
  rejeitada.
- **WARNING M4 RESOLVIDO:** o critério `imp-ignore-rollback` registrado pelo specs-validate em M4
  ("rollback condicional se servidor existir") está **resolvido** neste backlog: o rollback é
  obrigatório (FE-IMP-011 e FE-IMP-025).
