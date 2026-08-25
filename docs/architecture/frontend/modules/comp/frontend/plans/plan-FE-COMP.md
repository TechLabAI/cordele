# Plano de Execução FE — COMP (Composição) — Cordelê

> Gerado por `/fe-architect-backlog` · M5 · 2026-08-25
> Referência: `docs/architecture/frontend/modules/comp/_brief.md`
> Contexto: `clients/cordele/architecture/`

---

## Resumo do Projeto

O módulo COMP é a etapa de composição editorial do pipeline Cordelê: permite ao editor
configurar metadados do livro (título, autor, ISBN, idioma, capa) em T05 e ajustar o
layout tipográfico com preview página-a-página em T06. É um módulo **mid-pipeline** —
acessado via handoff de PROJ ou IMP com `projetoId`; nunca como landing.

O COMP usa prototype-first (D-493): as telas BA existentes no protótipo angular
(`configuracoes` e `editor-de-layout-preview`) são **promovidas** — não recriadas. O
trabalho de Promote consiste em: (a) conectar as telas ao Port/Adapter/Facade;
(b) remover os 3 botões estruturais da T06 (adicionarPagina/inserirImagem/removerPagina);
(c) substituir literais de cor por tokens `--paper-*`; (d) eliminar `shared/mock-data`.

Decisões estruturais já fechadas (M1–M4): rotas aninhadas por `:projetoId` (D-J); preview
via único GET `.../preview-context` (D-K); escrita pessimista (D-M); capa opcional ≤10 MB
(D-L); structuralEdits=false permanente (D-H); "Exportar" = navegação para PUB, nunca
mudança de status (D-M); 44 cláusulas EARS cobertas, 14 orphans defensivos.

---

## Mapa P1–P9

### P1 — Foundation (dias 1–2)
**Issues:** FE-COMP-001..005
**Goal:** Contratos, rotas, descriptor, nav service e shell registration prontos.
**DoD:** `nx build cordele-web` PASS; lazy chunk de `@cordele/comp` resolvido;
`COMP_MODULE_DESCRIPTOR` registrado no shell com `hiddenFromNav: true`.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-001 | comp.contract.ts, permission-map, feature-flags | S |
| FE-COMP-002 | comp.routes.ts — rotas parametrizadas :projetoId | M |
| FE-COMP-003 | COMP_MODULE_DESCRIPTOR + comp.bootstrap.ts | M |
| FE-COMP-004 | CompShellIntegrationService + COMP_NAV_CONFIG | M |
| FE-COMP-005 | Shell registration — module-descriptors.ts | S |

---

### P2 — Data access (dias 3–5)
**Issues:** FE-COMP-006..010
**Goal:** APIs, Facades e error mapping completos. Nenhum componente toca em `HttpClient`.
**DoD:** `nx test comp-data-access` PASS; body de PUT layout nunca contém `tipo=em-branco`.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-006 | MetadadosApiService — GET/PUT metadados, POST/DELETE capa | M |
| FE-COMP-007 | LayoutApiService — GET/PUT layout, GET preview-context | M |
| FE-COMP-008 | MetadataFacade — signals, state machine T05, eventos | L |
| FE-COMP-009 | LayoutFacade — signals, state machine T06, export | L |
| FE-COMP-010 | Error mapping — AppError → URN → feedback | S |

---

### P3 — Feature libs (dias 6–10)
**Issues:** FE-COMP-011..018
**Goal:** Todas as features T05 e T06 renderizadas (com dados das Facades). Sem mock-data.
**DoD:** `nx test comp-feature-metadata` e `nx test comp-feature-layout` PASS;
telas visíveis com dados da Facade stub.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-011 | feature-metadata routes + ConfiguracoesComponent (T05) | L |
| FE-COMP-012 | Presentacionais T05 — MetadataField, IdiomaSelect, AdvanceBar | M |
| FE-COMP-013 | CoverDropZoneComponent — upload, flag, 413/415 | M |
| FE-COMP-014 | feature-layout routes + EditorDeLayoutPreviewComponent (T06) | L |
| FE-COMP-015 | StylePanelComponent — 7 parâmetros PUB-honoured | M |
| FE-COMP-016 | PreviewCanvasComponent + PagePaginatorComponent | M |
| FE-COMP-017 | ImageAlignmentBadgeComponent + ExportBarComponent | M |
| FE-COMP-018 | StepBarComponent — pipeline Importar›Configurar›Edição›Exportar | M |

---

### P4 — Hub integrations (dias 6–10, paralelo com P3)
**Issues:** INT-FE-COMP-001..006
**Goal:** Integrações com shared (interceptors, access-decision, empresa) e módulos
vizinhos (PROJ, PUB) validadas.
**DoD:** Guards funcionam; "Exportar" navega para PUB; interceptors ativos.

| Issue | Descrição |
|---|---|
| INT-FE-COMP-001 | access-http-base interceptors + ErrorNormalize |
| INT-FE-COMP-002 | FE ↔ comp-service (contrato end-to-end) |
| INT-FE-COMP-003 | compStatusGuard ↔ PROJ (status do projeto) |
| INT-FE-COMP-004 | COMP ↔ PUB ("Exportar" navigation) |
| INT-FE-COMP-005 | AccessDecisionService — permissões e flags COMP |
| INT-FE-COMP-006 | empresaGuard + tenancy JWT COMP |

---

### P5 — Access guards + Promote cleanup (dia 11)
**Issues:** FE-COMP-019..022
**Goal:** Guards novos criados; toolbar estrutural removida; tokens de design aplicados.
**DoD:** DOM de T06 sem botões estruturais; `grep -r 'oklch\|mock-data' libs/comp/` → zero.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-019 | compProjetoGuard — UUID + resolvabilidade | M |
| FE-COMP-020 | compStatusGuard — em_composicao (FE-only UX) | M |
| FE-COMP-021 | Promote cleanup T06 — remover toolbar estrutural | S |
| FE-COMP-022 | Design tokens — substituir oklch(), remover mock-data | M |

---

### P6 — Navigation (dia 12)
**Issues:** FE-COMP-023
**Goal:** Breadcrumbs de COMP resolvidos dinamicamente com `{nome}` do projeto.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-023 | COMP_NAV_CONFIG breadcrumbs — Projetos › {nome} › ... | M |

---

### P7 — UX Polish (dia 12)
**Issues:** FE-COMP-024
**Goal:** Estados de carregamento, erro e vazio implementados (CLS-safe).

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-024 | Error/empty/loading states — skeletons e ErrorState | M |

---

### P8 — Observability (dia 13)
**Issues:** FE-COMP-025
**Goal:** 3 eventos de telemetria emitidos (metadata-opened, layout-opened, comp-exported).

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-025 | Telemetria COMP via @cordele/shared/observability | S |

---

### P9 — E2E + Hardening (dias 14–15)
**Issues:** FE-COMP-026..027
**Goal:** `nx e2e comp-e2e` PASS; gate `fe-ears-coverage` exit 0; 44/44 EARS cobertas.

| Issue | Descrição | Tamanho |
|---|---|---|
| FE-COMP-026 | Playwright e2e — configuracoes.feature (T05) | L |
| FE-COMP-027 | Playwright e2e — editor-de-layout-preview.feature (T06) | L |

---

## Caminho crítico

```
FE-COMP-001 → FE-COMP-006 → FE-COMP-008 → FE-COMP-011 → FE-COMP-026
FE-COMP-001 → FE-COMP-007 → FE-COMP-009 → FE-COMP-014 → FE-COMP-021 → FE-COMP-027
FE-COMP-019 + FE-COMP-020 → (desbloqueiam FE-COMP-011 e FE-COMP-014)
```

Caminho mais longo: **FE-COMP-001 → 006 → 008 → 011 → 026** (≈ 8 dias de trabalho sequencial).
Os testes e2e (P9) são o portão final antes do Promote completo.

---

## Top-3 Riscos

1. **compProjetoGuard e compStatusGuard inexistentes no shell** (warning M3/M4): estes guards
   bloqueiam as rotas COMP; precisam estar prontos antes de FE-COMP-011 e FE-COMP-014.
   Mitigação: FE-COMP-019/020 em P5 mas declarados como stubs em FE-COMP-002 logo no P1.

2. **Toolbar estrutural no protótipo BA** (warning M3/M4): a remoção cirúrgica em FE-COMP-021
   deve ser verificada antes do e2e; se o protótipo usar nomes de evento diferentes do esperado,
   a limpeza pode demorar mais. Mitigação: fazer grep no protótipo antes de FE-COMP-014.

3. **Rota PUB `/exportacao-e-validacao` pode não existir** (INT-FE-COMP-004): "Exportar" fica
   bloqueado se PUB não expõe essa rota. Mitigação: usar redirect placeholder enquanto PUB não
   fecha a rota; não bloquear P3/P4.

---

## Definition of Done por marco

| Marco | Critério |
|---|---|
| **P1 done** | `nx build cordele-web` PASS; COMP lazy-loadable; handoff PROJ→COMP sem 404 |
| **P2 done** | `nx test comp-data-access` PASS; PUT layout nunca envia `tipo=em-branco` |
| **P3 done** (MVP dev-shippable) | T05 e T06 renderizam com Facade; sem mock-data |
| **P5 done** | Guards ativos; toolbar estrutural removida; sem oklch() inline |
| **P9 done** (Promote completo) | `nx e2e comp-e2e` PASS; `fe-ears-coverage` exit 0 |

---

## Approval criteria por marco

| Marco | Quem aprova |
|---|---|
| P1 + P2 completos | Tech Lead (build + data-access passando) |
| P3 completo | Product (telas visuais com dados reais) |
| P5 completo | Tech Lead (toolbar removida, tokens aplicados) |
| P9 completo | Tech Lead + QA (e2e PASS, EARS 44/44) |
