# Issues Map — FE-COMP (Composição) — Frontend

> Cordelê · module `comp` · prefix `COMP` · app `cordele-web` · 27 funcionais + 6 INT = **33 issues**

---

## Resumo

| Categoria | Quantidade |
|---|---|
| Issues funcionais (FE-COMP-*) | 27 |
| Issues de integração (INT-FE-COMP-*) | 6 |
| **Total** | **33** |

---

## Por prioridade (P1–P9)

| Onda | Issues | Descrição |
|---|---|---|
| P1 Foundation | FE-COMP-001..005 | Module contract, routes, descriptor/bootstrap, nav service, shell registration |
| P2 Data access | FE-COMP-006..010 | MetadadosApiService, LayoutApiService, MetadataFacade, LayoutFacade, error mapping |
| P3 Feature libs | FE-COMP-011..018 | T05 smart + presentacionais; T06 smart + StylePanel, Canvas, Alignment, StepBar |
| P4 Hub integrations | INT-FE-COMP-001..006 | access-http-base, comp-service, guards↔PROJ, COMP↔PUB, access-decision, empresa-context |
| P5 Access guards + Promote | FE-COMP-019..022 | compProjetoGuard, compStatusGuard, remoção toolbar estrutural, design tokens |
| P6 Navigation | FE-COMP-023 | COMP_NAV_CONFIG breadcrumbs |
| P7 UX polish | FE-COMP-024 | Error state, empty state, skeletons |
| P8 Observability | FE-COMP-025 | Telemetria: metadata-opened, layout-opened, comp-exported |
| P9 e2e + Hardening | FE-COMP-026..027 | Playwright T05 e T06 |

---

## Por SPEC (SPEC → Issues)

| SPEC | Issues geradas |
|---|---|
| SPEC-01 (Route Map) | FE-COMP-002, FE-COMP-019, FE-COMP-020, INT-FE-COMP-003, INT-FE-COMP-004 |
| SPEC-02 (Component Hierarchy) | FE-COMP-011..018, FE-COMP-024 |
| SPEC-03 (View Models) | FE-COMP-008, FE-COMP-009 |
| SPEC-04 (Data Access) | FE-COMP-006..009, INT-FE-COMP-001, INT-FE-COMP-002 |
| SPEC-05 (Module Contract) | FE-COMP-001, FE-COMP-003, FE-COMP-013, FE-COMP-015, FE-COMP-021, INT-FE-COMP-005 |
| SPEC-06 (Shell Integration) | FE-COMP-004, FE-COMP-005, FE-COMP-023, FE-COMP-025, INT-FE-COMP-006 |
| SPEC-07 (Error Handling) | FE-COMP-010, FE-COMP-024, INT-FE-COMP-001 |
| SPEC-08 (E2E Scenarios) | FE-COMP-026, FE-COMP-027 |
| contracts/backend-api-cross-link.md | FE-COMP-006, FE-COMP-007, INT-FE-COMP-002, INT-FE-COMP-006 |
| contracts/design-tokens.md | FE-COMP-022 |
| D-493 Promote cleanup | FE-COMP-021, FE-COMP-022 |

---

## Por camada (Layer → Issues)

| Camada | Path | Issues |
|---|---|---|
| Module contract | `libs/comp/shell-entry` | FE-COMP-001, FE-COMP-002, FE-COMP-003 |
| Shell integration | `apps/cordele-web` + `libs/comp/integration` | FE-COMP-004, FE-COMP-005 |
| Data access | `libs/comp/data-access` | FE-COMP-006..010 |
| Feature metadata | `libs/comp/feature-metadata` | FE-COMP-011, FE-COMP-012 |
| Feature layout | `libs/comp/feature-layout` | FE-COMP-014 |
| UI (lib local) | `libs/comp/ui` | FE-COMP-013, FE-COMP-015..018, FE-COMP-024 |
| Access guards | `libs/comp/access` | FE-COMP-019, FE-COMP-020 |
| Navigation | `libs/comp/navigation` | FE-COMP-023 |
| Styles/tokens | `libs/comp/styles` | FE-COMP-022 |
| Promote cleanup | `libs/comp/feature-layout` + `libs/comp/ui` | FE-COMP-021 |
| Observability | `libs/comp/integration` | FE-COMP-025 |
| E2E | `apps/comp-e2e` | FE-COMP-026, FE-COMP-027 |
| Integração shared | cross | INT-FE-COMP-001, INT-FE-COMP-005, INT-FE-COMP-006 |
| Integração BE | cross | INT-FE-COMP-002 |
| Integração PROJ | cross | INT-FE-COMP-003 |
| Integração PUB | cross | INT-FE-COMP-004 |

---

## Caminho crítico (dependências bloqueantes)

```
FE-COMP-001 (contrato)
  └─ FE-COMP-002 (routes)
       └─ FE-COMP-019 (compProjetoGuard)
       └─ FE-COMP-020 (compStatusGuard)
            └─ FE-COMP-011 (T05 smart)
                 └─ FE-COMP-012 (presentacionais T05)
                 └─ FE-COMP-013 (CoverDropZone)
                      └─ FE-COMP-026 (e2e T05)
  └─ FE-COMP-003 (descriptor)
       └─ FE-COMP-005 (shell registration)

FE-COMP-006 (MetadadosApiService)
  └─ FE-COMP-008 (MetadataFacade)
       └─ FE-COMP-010 (error mapping)
            └─ FE-COMP-011 (T05 smart)

FE-COMP-007 (LayoutApiService)
  └─ FE-COMP-009 (LayoutFacade)
       └─ FE-COMP-014 (T06 smart)
            └─ FE-COMP-015 (StylePanel)
            └─ FE-COMP-016 (Canvas + Paginator)
                 └─ FE-COMP-017 (Alignment + ExportBar)
                 └─ FE-COMP-021 (remove toolbar)
                      └─ FE-COMP-022 (tokens)
                           └─ FE-COMP-027 (e2e T06)
```

---

## Estimativas (S/M/L por issue)

| Tamanho | Issues |
|---|---|
| S (< 4h) | FE-COMP-001, FE-COMP-005, FE-COMP-010, FE-COMP-021, FE-COMP-023, FE-COMP-025 |
| M (~1 dia) | FE-COMP-002, FE-COMP-003, FE-COMP-004, FE-COMP-006, FE-COMP-007, FE-COMP-012, FE-COMP-013, FE-COMP-015..018, FE-COMP-019, FE-COMP-020, FE-COMP-022, FE-COMP-024, INT-FE-COMP-001..006 |
| L (≤ 1 dia esforçado) | FE-COMP-008, FE-COMP-009, FE-COMP-011, FE-COMP-014, FE-COMP-026, FE-COMP-027 |

---

## Notas sobre os 14 orphan EARS (defensivos)

Os 14 orphan slugs (identificados no gate `fe-ears-coverage` em M4) são cláusulas de
qualidade/segurança sem cenário BDD próprio — cobertura está nas issues de error handling e
guards listadas acima. **Não foram geradas issues de "cláusula faltante" para eles** (são
defensivos por construção: DH/DK/DM e SPEC-07 §2 do illegal-status).
