# Plano de Execução FE — Módulo PROJ (Projetos)

> Cordelê · módulo `proj` · prefixo `PROJ` · app `cordele-web` · scope `@cordele`
> Gerado por `/fe-architect-backlog cordele PROJ` (M5 autopilot, trace `tr_f2cd686cfce8`).
> Referência: `docs/architecture/frontend/modules/proj/_brief.md`

---

## 1. Resumo do projeto

O módulo PROJ implementa as duas telas centrais do pipeline editorial do Cordelê:

- **T02 — Biblioteca de projetos** (`/biblioteca-de-projetos`): a tela home do editor após login.
  Exibe todos os projetos da editora com o status atual (rascunho, em composição, publicado,
  com erros) e o badge derivado do último epubcheck. O editor pode abrir um projeto no módulo
  correto (IMP/COMP/histórico), criar um novo (→ IMP) ou fazer quick-download da última versão.

- **T08 — Download e histórico** (`/projetos/:projetoId/historico`): exibe o cabeçalho do projeto
  com os CTAs de ação (Ajustar metadados/layout → reopen + COMP, Nova exportação → PUB) e a
  lista de publicações com status epubcheck e botões de download por URL assinada.

PROJ é o **módulo home** (pós-login landing, `isHome: true`, `order: 0`). É também a única
autoridade do status do projeto no Cordelê; os módulos IMP, COMP e PUB avançam o status via
`advanceTo` in-process no monólito modular, mas apenas PROJ expõe e gerencia esse estado para o FE.

O módulo segue **prototype-to-production** (D-493): os componentes visuais são promovidos das telas
`biblioteca-de-projetos` e `download-e-historico` do protótipo BA, desconectados de mocks e
conectados às facades de sinal. A camada lógica (facades, serviços, guards, navigation) é construída
do zero alinhada com as specs M3/M4.

---

## 2. Mapa de Ondas P1-P9

| Onda | Issues | Estimativa | Status ao final |
|---|---|---|---|
| **P1 — Foundation** | FE-PROJ-001..006 | 3 dias | Shell reconhece PROJ como home; routes OK; guards aplicados |
| **P2 — Data Access** | FE-PROJ-007..011 | 5 dias | Facades operacionais; API integrada; navegação stage-aware funcional |
| **P3 — Feature Libs** | FE-PROJ-012..016 | 7 dias | T02 e T08 renderizando; download via URL assinada; badge derivado |
| **P4 — Guards + INT** | FE-PROJ-017..018 + INT-FE-PROJ-001..006 | 5 dias | Guards completos; integrações cross-module testadas; permissões wired |
| **P5 — UX Polish** | FE-PROJ-019..021 | 3 dias | Skeletons CLS-safe; error states; degradação parcial (SPEC-07 §2) |
| **P6 — LGPD** | FE-PROJ-022 | 0.5 dia | Capacidade data-access LGPD documentada; UI deferida registrada |
| **P7 — Observability** | FE-PROJ-023 | 0.5 dia | 4 lifecycle events emitidos via @cordele/shared/observability |
| **P8 — e2e** | FE-PROJ-024..025 | 4 dias | 29 cenários Playwright passando (14 + 15) |
| **P9 — Informacional** | FE-PROJ-026 | — | Origem dos 15 cenários órfãos documentada |

**Estimativa total:** ~28 dias de trabalho para 1 desenvolvedor.
**Com 2 devs em paralelo (P2-P3 parcialmente paralelizáveis):** ~16 dias.

---

## 3. Caminho Crítico

```
FE-PROJ-001 ──► FE-PROJ-002 ──► FE-PROJ-007 ──► FE-PROJ-008 ──► FE-PROJ-010
                                                                       │
                                                                  FE-PROJ-014
                                                                       │
                                                                  FE-PROJ-015
                                                                       │
                                                                  FE-PROJ-025

FE-PROJ-008 ──► FE-PROJ-009 ──► FE-PROJ-012 ──► FE-PROJ-024
FE-PROJ-011 ──► FE-PROJ-005 ──► FE-PROJ-003 ──► FE-PROJ-006
```

**Caminho mais longo (9 níveis):** `001 → 002 → 007 → 008 → 010 → 014 → 015 → 025`

**Paralelo possível desde P2:**
- Dev A: `007 → 008 → 009 → 012 → 024` (T02 flow)
- Dev B: `007 → 008 → 010 → 011 → 014 → 015 → 025` (T08 flow)

---

## 4. Riscos Top-3

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **R1 — Reopen flow: COMP/IMP ainda não deployados** | Alta | Médio | Feature flag `proj.reopen` como kill-switch; navigate usa placeholder e é atualizado quando COMP/IMP forem scaffolded (INT-FE-PROJ-003/004) |
| **R2 — PublicationHistoryPort degradação: formato de payload não confirmado** | Média | Médio | Fixture criada com formato conservador; validar com `proj-service` api-contract §4.3 antes de commitar (INT-FE-PROJ-005) |
| **R3 — @cordele/shared/access-decision, observability e empresa-context não estáveis** | Média | Alto | Criar interfaces locais (`AccessDecisionPort`, `ObservabilityPort`) e stubs; abrir PR para shared; não hardcodar roles |

---

## 5. Definition of Done por Onda

### P1 done (MVP de shell integration)
- `PROJ_MODULE_DESCRIPTOR` registrado no Shell
- Shell redireciona `''` → `/biblioteca-de-projetos` após login
- `nx build cordele-web` sem erros
- `projInit()` não emite nenhuma chamada HTTP

### P2 done (Data access completo)
- `ProjetoApiService`: 7 métodos testados (6 + delete LGPD)
- `LibraryFacade` e `HistoryFacade` com state machines cobrindo todas as transições (SPEC-04 §2)
- Reopen pessimista: navigate ocorre **somente** após 200
- `nx test proj-data-access` 100% passando
- Stage-aware resolver cobre os 4 status sem dead-end

### P3 done (MVP shippável em dev)
- T02: biblioteca renderiza com dados reais (ou MSW); badge derivado correto; quick-download funciona
- T08: histórico hidrata com forkJoin; reopen navega para COMP; download abre URL assinada em nova aba
- Nenhum import de mock no bundle de produção
- Nenhuma ocorrência de `oklch(` inline nos templates promovidos

### P4 done (Integração completa)
- `projProjetoGuard` bloqueia UUID malformado sem chamar a API
- Permissões `proj.download` e `proj.reopen` gateadas via `AccessDecisionService`
- Feature flags `proj.quickDownload` e `proj.reopen` funcionam como kill-switch
- INT-FE-PROJ-001..006 testados

### P5 done (UX robusta)
- Estado de erro com retry funcional em T02 e T08
- 6 URNs de SPEC-07 §1 mapeados para UI
- `degraded:true` mantém `status=ready` e exibe marcadores específicos (não genéricos)
- Skeletons CLS-safe (altura idêntica ao conteúdo real)

### P8 done (e2e verde)
- 29 cenários Playwright passando (14 T02 + 15 T08)
- CI verde em 2 runs consecutivos
- Nenhum `page.waitForTimeout` no código e2e

---

## 6. Approval Criteria por Marco

| Marco | Critério de aprovação |
|---|---|
| **P1 done** | Shell exibe "Projetos" no nav e redireciona `''` → `/biblioteca-de-projetos` |
| **P3 done = MVP em dev** | Editor autentica, vê a biblioteca, abre o histórico, faz download de uma publicação |
| **P4 done = integração** | Reopen navega para IMP/COMP; e2e de reopen passa com mock de POST |
| **P8 done = shippável** | CI verde; Playwright 29/29; performance budget OK |

---

## 7. Notas de Arquitetura

- **Prototype-to-production (D-493):** as telas T02 e T08 existem no protótipo BA em
  `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/`. A Promote
  move os arquivos para `libs/proj/feature-*/`, remove mocks e conecta às facades. Não re-inventa a UI.

- **ADR-PROJ-001 (server-authoritative):** nenhuma facade armazena cache entre rotas. A biblioteca
  re-busca em cada entrada; o histórico re-busca em cada entrada de `/projetos/:id/historico`. O reopen
  é pessimista (aguarda 200 antes de navegar). Sem shared store cross-module.

- **Badge derivado (SPEC-03 §3):** o badge é computado no mapper (não no componente). O mapper
  cobre 6 cases (draft, progress, valid, warn, error, pending). `canDownload` é derivado de
  `arquivoUrl != null` — nunca do `epubcheckStatus` string diretamente.

- **Download D-F:** a SPA nunca faz proxy de bytes. `resolveDownloadUrl()` retorna `{ arquivoUrl }`;
  o caller faz `window.open(url, '_blank')`. URL de TTL curto, mintada por clique.

- **LGPD erasure (D-G):** `deleteProjeto` existe na camada de data-access sem affordance de UI no
  MVP. A cadeia cross-context (PROJ→IMP→COMP→PUB) é orquestrada no BE. O FE habilita a UI quando
  aprovado adicionando `proj.delete` ao `PROJ_PERMISSION_MAP` check e um modal de confirmação.

- **15 cenários e2e defensivos (FE-PROJ-026):** documentados em `FE-PROJ-026`; cobertos pelos
  testes unitários das facades. Não remover sem consultar a issue informacional.
