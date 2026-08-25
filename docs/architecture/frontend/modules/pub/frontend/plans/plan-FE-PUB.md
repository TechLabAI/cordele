# plan-FE-PUB.md — Plano de Execução Frontend — PUB (Publicação) — Cordelê

> Gerado por: fe-architect-backlog · 2026-08-25
> Âncora: `docs/architecture/frontend/modules/pub/_brief.md`
> Prototype-first (D-493): telas T07 (`exportacao-e-validacao`) e T08 (`download-e-historico`)
> promovidas do `frontend/design-reference/angular-prototype/`.

## Resumo do projeto

PUB é o módulo de fechamento do pipeline editorial do Cordelê: dado um projeto em `em_composicao`,
dispara a geração do ePub via `pub-service`, faz poll limitado do build (POST 202 + GET status com
Retry-After — sem SSE, ADR-PUB-001/D-N), exibe o veredito epubcheck server-authoritative
(`valido`/`avisos` → download habilitado; `erros_criticos` → download bloqueado), e expõe
o histórico de publicações com stats ao vivo.

Dois exemplares de feature: T07 (`/projetos/:id/exportacao-e-validacao`) e T08
(`/projetos/:id/download-e-historico`). Nenhum landing module — PUB é sempre entrado com `projetoId`
de COMP ou PROJ. Dois gaps explícitos: lista detalhada de avisos (bloqueada por PUB-016 BE) e KPIs
de ePub (Tamanho/Páginas/Capítulos/Imagens, sem campo-fonte — decisão de produto pendente).

## Mapa Wave P1–P9

| Wave | Foco | Issues | Estimativa | Entregável |
|---|---|---|---|---|
| P1 | Foundation | FE-PUB-001..006 | 3 dias | Shell registra PUB; routes ativas; bootstrap estável |
| P2 | Data Access | FE-PUB-007..011 | 4 dias | Toda I/O de PUB coberta por services + facades + error map |
| P3 | Feature Libs | FE-PUB-012..020 | 6 dias | T07 e T08 renderizando via facades; protótipo promovido sem mocks |
| P4 | Hub Integrations | INT-FE-PUB-001..006 | 2 dias | Interceptors, cross-context PROJ/COMP, gaps documentados |
| P5 | Access Guards | FE-PUB-021..022 | 1 dia | Guards UUID + status operacionais |
| P6 | Navigation | FE-PUB-023 | 0,5 dia | Breadcrumbs e step-bar registrados corretamente |
| P7 | UX Polish | FE-PUB-024..025 | 1,5 dia | Loading/error/empty states e download gate completos |
| P8 | Observability | FE-PUB-026 | 0,5 dia | Telemetria: 3 lifecycle events com correlationId |
| P9 | E2E + Hardening | FE-PUB-027..028 | 3 dias | 26 cenários Playwright T07+T08 passando |
| **Total** | | **34 issues** | **~21,5 dias** | |

## Caminho crítico

```
[P1] FE-PUB-001 → FE-PUB-002 → FE-PUB-003 → FE-PUB-004
                                           ↓
[P2] FE-PUB-007 + FE-PUB-008 → FE-PUB-009 → FE-PUB-011
                              → FE-PUB-010
                                           ↓
[P3] FE-PUB-012 (T07, promote + strip mocks) → FE-PUB-013..017
     FE-PUB-018 (T08, promote + strip mocks) → FE-PUB-019..020
                                           ↓
[P4] INT-FE-PUB-001..006 (paralelo P3)
[P5] FE-PUB-021..022 (paralelo P3, precisa de P1)
[P6] FE-PUB-023 (após P1)
[P7] FE-PUB-024..025 (após P2+P3)
[P8] FE-PUB-026 (após P2+P3)
[P9] FE-PUB-027 (após P3 T07 completo) + FE-PUB-028 (após P3 T08 completo)
```

## Riscos top-3

| # | Risco | Mitigação |
|---|---|---|
| R1 | **INT-FE-PUB-004 bloqueada indefinidamente**: lista detalhada de avisos sem endpoint ratificado (PUB-016 BE). FE-PUB-016 fica com MVP mínimo (contagens apenas). | Não implementar chamada a §4.6 sem aprovação; UI já preparada para ser extendida quando desbloqueado. |
| R2 | **INT-FE-PUB-005 (KPIs de ePub) sem campo-fonte**: tiles sempre null no MVP. PM precisa decidir fonte antes do M5. | EpubSummaryGridComponent null-safe por design; nenhum dado fabricado. Tile simplesmente oculto. |
| R3 | **Promote do protótipo com artefatos de mock residuais**: setInterval/AVISOS_MOCK/"Simular estado" do protótipo ativo na produção. | Checklist explícito em FE-PUB-012 e FE-PUB-018; testes unitários verificam ausência de setInterval e referências a mock-data. |

## Definition of Done por Wave

| Wave | DoD |
|---|---|
| P1 | `nx build pub-shell-entry` PASS; PUB aparece no menu do Shell; routes ativas |
| P2 | `nx test pub-data-access` PASS; ExportFacade poll funcional com mocks HTTP; HistoryFacade carrega |
| P3 | `nx test pub-feature-export` + `nx test pub-feature-history` PASS; sem mock residual; protótipo promovido |
| P4 | Interceptors validados; cross-context PROJ/COMP operacional; gaps INT-004/005 documentados e bloqueados |
| P5 | Guards cobertos por testes parametrizados |
| P6 | PUB_NAV_CONFIG.stageIndex === 3; breadcrumb correto por rota |
| P7 | States de loading/error/empty verificados; download gate e re-fetch de URL expirada operacionais |
| P8 | 3 lifecycle events publicados com correlationId |
| P9 | `npx nx e2e pub-e2e` exit 0 (26 cenários T07+T08) |

## Approval criteria por marco

| Marco | Critério |
|---|---|
| **P3 done (MVP dev-shippable)** | T07 e T08 funcionais com backend real; poll limita-se ao Retry-After; download via signed URL; sem mocks residuais |
| **P4 done** | Tenant isolation via empresa switch cancela poll; cross-context PROJ/COMP operacional |
| **P9 done (pronto para promote)** | 26 cenários Playwright PASS; todos os gaps documentados (INT-004/005) com status explícito de bloqueio |

## Próxima ação

```
-> /fe-architect-scaffold cordele PUB
```
