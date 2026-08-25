# Issues Map — FE PUB (Publicação) — Cordelê

> Módulo `pub` · prefix `PUB` · app `cordele-web` · scope `@cordele`
> Gerado por: fe-architect-backlog · 2026-08-25
> Prototype-first (D-493): telas T07 e T08 promovidas do protótipo angular-prototype.

## Totais

| Categoria | Quantidade |
|---|---|
| Issues funcionais (FE-PUB-*) | 28 |
| Issues de integração (INT-FE-PUB-*) | 6 |
| **Total** | **34** |

## Por Prioridade (Waves P1–P9)

### P1 — Foundation (Wave 1) — estimativa: 3 dias

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-001 | Module contract — pub.contract.ts, permission-map, feature-flags | S |
| FE-PUB-002 | Module routes — pub.routes.ts, PubRootComponent | S |
| FE-PUB-003 | Module descriptor + bootstrap — pub.descriptor.ts, pub.bootstrap.ts | S |
| FE-PUB-004 | Shell registration — PUB_MODULE_DESCRIPTOR em module-descriptors.ts | S |
| FE-PUB-005 | Navigation config — PUB_NAV_CONFIG, StepBarComponent stage 4 | S |
| FE-PUB-006 | PubShellIntegrationService — empresa subscription, nav registration, lifecycle breadcrumbs | M |

### P2 — Data Access (Wave 2) — estimativa: 4 dias

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-007 | PublicacaoApiService — trigger, getStatus, listByProjeto, getStats, getProjetoHeader, getAutor + DTOs | M |
| FE-PUB-008 | ArtifactDownloadService — getSignedUrl, download (signed-URL, nunca byte stream) | M |
| FE-PUB-009 | ExportFacade — state machine, bounded poll, Retry-After, requestExport, resumeExport | L |
| FE-PUB-010 | HistoryFacade — openHistory, download, newExport, adjustMetadata, backToLibrary | M |
| FE-PUB-011 | Error mapping — AppError URN → mensagem pt-BR + canal (SPEC-07) | S |

### P3 — Feature Libs (Wave 3) — estimativa: 6 dias

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-012 | feature-export routes + ExportacaoEValidacaoComponent (T07 smart — promote + strip mocks) | L |
| FE-PUB-013 | ExportProgressCardComponent — fase gerando (indeterminado) e error + retry | S |
| FE-PUB-014 | EpubcheckResultBannerComponent — veredito server-authoritative (ADR-PUB-001) | S |
| FE-PUB-015 | EpubSummaryGridComponent + KpiTileComponent — null-safe; tile omitido quando sem fonte | S |
| FE-PUB-016 | WarningsDetailsComponent — contagens + resumoErro; lista detalhada bloqueada (PUB-016 BE gap) | M |
| FE-PUB-017 | ExportActionsBarComponent — gate podeBaixar, "← Ajustar layout", "⬇ Baixar ePub" | S |
| FE-PUB-018 | feature-history routes + DownloadEHistoricoComponent (T08 smart — promote + strip mocks) | L |
| FE-PUB-019 | ProjectPublicationHeaderComponent + PublicationKpiRowComponent (T08 header + stats KPIs) | M |
| FE-PUB-020 | PublicationHistoryListComponent, PublicationHistoryRowComponent, HistoryEmptyStateComponent, BackToLibraryLinkComponent | M |

### P4 — Hub Integrations (Wave 4)

| ID | Título | Tamanho |
|---|---|---|
| INT-FE-PUB-001 | Integração @cordele/shared/access-http-base — interceptors, ErrorNormalize, traceId | S |
| INT-FE-PUB-002 | Integração cross-context PROJ — getProjetoHeader (T08 header) | S |
| INT-FE-PUB-003 | Integração cross-context COMP — getAutor (T08 subtitle metadados) | S |
| INT-FE-PUB-004 | Ratificação §4.6 lista detalhada de avisos — BLOQUEADO (PUB-016 BE pendente) | M |
| INT-FE-PUB-005 | KPIs de resumo ePub — decisão de produto pendente; tile omitido, nunca fabricado | M |
| INT-FE-PUB-006 | EmpresaContext / empresa switch — cancelamento de poll ativo | S |

### P5 — Access Guards (Wave 5) — estimativa: 1 dia

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-021 | pubProjetoGuard — UUID bem-formado, redirect em parâmetro inválido | S |
| FE-PUB-022 | pubStatusGuard — modo export (em_composicao) e modo history (≥1 Publicacao) | M |

### P6 — Navigation / Breadcrumbs (Wave 6) — estimativa: 0,5 dia

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-023 | Breadcrumb state — PUB_NAV_CONFIG, barra 4 etapas integrada ao NavigationService | S |

### P7 — UX Polish (Wave 7) — estimativa: 1,5 dia

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-024 | Loading states, error banners e empty states unificados (T07 + T08) | M |
| FE-PUB-025 | Download gate — label "inválido", auto re-fetch URL expirada, ciclo de vida do signed-URL | M |

### P8 — Observability (Wave 8) — estimativa: 0,5 dia

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-026 | Telemetria — eventos export-requested, verdict-shown, downloaded | S |

### P9 — E2E + Hardening (Wave 9) — estimativa: 3 dias

| ID | Título | Tamanho |
|---|---|---|
| FE-PUB-027 | Playwright e2e — T07 exportacao-e-validacao.feature (19 cenários SPEC-08) | L |
| FE-PUB-028 | Playwright e2e — T08 download-e-historico.feature (7 cenários SPEC-08) | M |

## Por SPEC (qual SPEC alimenta quais issues)

| SPEC | Issues |
|---|---|
| SPEC-01 (Route Map) | FE-PUB-001, FE-PUB-002, FE-PUB-021, FE-PUB-022 |
| SPEC-02 (Component Hierarchy) | FE-PUB-012..020, FE-PUB-005 |
| SPEC-03 (View Models) | FE-PUB-009, FE-PUB-010, FE-PUB-015, FE-PUB-016, INT-FE-PUB-004, INT-FE-PUB-005 |
| SPEC-04 (Data Access) | FE-PUB-007, FE-PUB-008, FE-PUB-009, FE-PUB-010, FE-PUB-025, INT-FE-PUB-006 |
| SPEC-05 (Module Contract) | FE-PUB-001, FE-PUB-003, FE-PUB-004 |
| SPEC-06 (Shell Integration) | FE-PUB-003, FE-PUB-004, FE-PUB-006, FE-PUB-023, FE-PUB-026, INT-FE-PUB-006 |
| SPEC-07 (Error Handling) | FE-PUB-011, FE-PUB-024, FE-PUB-025, INT-FE-PUB-001 |
| SPEC-08 (E2E Scenarios) | FE-PUB-027, FE-PUB-028 |
| backend-api-cross-link.md | INT-FE-PUB-001..006 |

## Por Camada (onde o trabalho acontece)

| Camada | Issues |
|---|---|
| `libs/pub/shell-entry` | FE-PUB-001..004 |
| `libs/pub/navigation` | FE-PUB-005, FE-PUB-023 |
| `libs/pub/integration` | FE-PUB-006, FE-PUB-026, INT-FE-PUB-006 |
| `libs/pub/data-access` | FE-PUB-007..011, INT-FE-PUB-001..005 |
| `libs/pub/feature-export` | FE-PUB-012, FE-PUB-024 |
| `libs/pub/ui` | FE-PUB-013..017, FE-PUB-019..020, FE-PUB-025 |
| `libs/pub/feature-history` | FE-PUB-018, FE-PUB-024 |
| `libs/pub/access` | FE-PUB-021, FE-PUB-022 |
| `apps/cordele-web (Shell)` | FE-PUB-004 |
| `apps/pub-e2e` | FE-PUB-027, FE-PUB-028 |

## Dependências críticas (caminho mais longo)

```
FE-PUB-001 ──► FE-PUB-002 ──► FE-PUB-012 ──► FE-PUB-027
          └──► FE-PUB-003 ──► FE-PUB-004
          └──► FE-PUB-005
          └──► FE-PUB-006
                    │
FE-PUB-007 ──► FE-PUB-009 ──► FE-PUB-012
          └──► FE-PUB-010 ──► FE-PUB-018 ──► FE-PUB-028
FE-PUB-008 ──► FE-PUB-009
               FE-PUB-011

INT-FE-PUB-004 ─── BLOQUEADO (PUB-016 BE) ──► FE-PUB-016 (lista detalhada)
INT-FE-PUB-005 ─── BLOQUEADO (produto)    ──► FE-PUB-015 (KPI tiles)
```

## Issues bloqueadas / gaps explícitos

| Issue | Gap | Bloqueante |
|---|---|---|
| INT-FE-PUB-004 | Lista detalhada de avisos `{code,msg,local}` — endpoint §4.6 não ratificado | PUB-016 BE (aprovação FE obrigatória antes de implement) |
| INT-FE-PUB-005 | KPIs ePub (Tamanho/Páginas/Capítulos/Imagens) sem campo-fonte no api-contract §6 | Decisão de produto pendente (PM/Tech Lead) |
| FE-PUB-016 | WarningsDetailsComponent exibe contagens apenas; lista detalhada vazia no MVP | INT-FE-PUB-004 |
| FE-PUB-015 | EpubSummaryGrid tile omitido quando null | INT-FE-PUB-005 |
