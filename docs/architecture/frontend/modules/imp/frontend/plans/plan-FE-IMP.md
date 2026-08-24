# Plano de Execução FE — Módulo IMP (Importação)

> Cordelê · módulo `imp` · prefixo `IMP` · app `cordele-web` · scope `@cordele`
> Gerado por `/fe-architect-backlog cordele IMP` (M5 autopilot D-452).
> Referência: `docs/architecture/frontend/modules/imp/_brief.md`

---

## 1. Resumo do projeto

O módulo IMP implementa as duas telas de entrada do pipeline editorial do Cordelê:

- **T03 — Upload de manuscrito** (`/imp/upload`): editor arrasta/seleciona um arquivo `.docx` ou
  `.md`, informa o nome do projeto (ou anexa a um projeto existente) e submete. O parse é
  **síncrono** — a resposta 201 já contém o resultado completo. Não há polling, não há `parseJobId`.

- **T04 — Revisão de estrutura** (`/imp/manuscritos/:manuscritoId/revisao`): exibe os contadores
  de capítulos, imagens e trechos não-parseados; permite ignorar trechos individualmente (com
  chamada de API real + rollback em caso de falha — addendum M4); e confirma a estrutura, avançando
  o projeto de `rascunho → em_composicao` via `POST /confirm-estrutura` (também addendum M4).

O módulo segue prototype-first (D-493): os componentes visuais são promovidos do protótipo BA
(`frontend/design-reference/angular-prototype/`), desconectados de mocks e conectados a facades.
A camada lógica (facades, serviços, guards) é construída do zero alinhada com as specs M3/M4.

---

## 2. Mapa de Ondas P1-P9

| Onda | Issues | Estimativa | Status ao final |
|---|---|---|---|
| **P1 — Foundation** | FE-IMP-001..005 | 3 dias | Shell reconhece IMP; routes OK; guards aplicados |
| **P2 — Data Access** | FE-IMP-006..011 + INT-FE-IMP-001..002 | 6 dias | Façades operacionais; API integrada; addendum M4 coberto |
| **P3 — Feature Libs** | FE-IMP-012..018 + INT-FE-IMP-003..004 | 7 dias | T03 e T04 renderizando; error handling; confirm navegando para COMP |
| **P4 — Guards + Nav** | FE-IMP-019..020 + INT-FE-IMP-005..006 | 3 dias | Guards de UUID; empresa-switch cancel; breadcrumb dinâmico |
| **P5 — UX Polish** | FE-IMP-021..022 | 1.5 dias | Mapeamento completo de erros; skeletons |
| **P6 — Observability** | FE-IMP-023 | 0.5 dia | Lifecycle events emitidos |
| **P7 — e2e** | FE-IMP-024..025 | 3 dias | 18 cenários Playwright passando |

**Estimativa total:** ~24 dias de trabalho para 1 desenvolvedor.
**Com 2 devs em paralelo (P1-P3 parcialmente paralelizável):** ~14 dias.

---

## 3. Caminho crítico

```
FE-IMP-001 ──> FE-IMP-006 ──> FE-IMP-007 ──> FE-IMP-009 ──> FE-IMP-011
                                                                    │
                                                               FE-IMP-017
                                                                    │
                                                               FE-IMP-025

FE-IMP-010 ──> FE-IMP-013 ──> FE-IMP-024
```

O caminho mais longo (8 níveis) termina em `FE-IMP-025` (e2e revisão de estrutura):
`001 → 006 → 007 → 009 → 011 → 017 → 025`.

**Paralelo possível desde P2:** enquanto `FE-IMP-010`/`FE-IMP-013` (upload flow) avança,
`FE-IMP-009`/`FE-IMP-011` (review flow + addendum) pode ser trabalhado por outro dev.

---

## 4. Definition of Done por Onda

### P1 done (MVP de shell integration)
- `IMP_MODULE_DESCRIPTOR` registrado no Shell
- `nx build cordele-web` sem erros
- Rota `/imp` redireciona para `/imp/upload` com guards corretos

### P2 done (Data access completo)
- `ManuscriptApiService`: upload + leitura + addendum (4 endpoints §8) testados
- `ImportFacade` e `ReviewFacade` com state machines cobrindo todos transitions
- Rollback de ignore obrigatório implementado em `ReviewFacade`
- `nx test imp-data-access` 100% passando

### P3 done (MVP shippável em dev)
- T03: upload funciona end-to-end (sem stub de API — usa rota real ou MSW)
- T04: revisão de estrutura hidrata, pendências renderizam, confirm navega para COMP
- `nx test imp-feature-upload imp-feature-review` passando

### P4 done (hardening de acesso)
- `impProjetoGuard` bloqueia UUIDs malformados
- Empresa-switch cancela upload em voo
- Breadcrumb dinâmico com nome do arquivo em T04

### P7 done (e2e completo)
- 18/18 cenários Playwright passando em CI
- Cenário de rollback de ignore presente e passando

---

## 5. Riscos top-3

### R1 — Shared libs incompletas bloqueiam P3/P4
`@cordele/shared/access-http-base` (interceptors), `@cordele/shared/access-decision`
(`AccessDecisionService`) e `@cordele/shared/empresa-context` (`EmpresaContext`) precisam estar
disponíveis antes do P3/P4. Se estiverem incompletos, usar stubs com `TODO[lote-X]` e marcar
as issues de integração como bloqueadas.

**Mitigação:** Criar interfaces locais (adapter pattern) que serão substituídas quando o shared
chegar — não bloquear P3.

### R2 — Rota COMP inexistente no handoff pós-confirm
`INT-FE-IMP-003` navega para `/comp/config?projetoId=...`. Se COMP não estiver implementado,
a navegação falha graciosamente (404 page do router). Não é um bloqueio para o módulo IMP.

**Mitigação:** Testar com `Router.navigate` mock; no e2e usar `page.route('/comp/*')` como stub.

### R3 — Addendum M4 é breaking em relação ao que M3 especificou
`FE-IMP-009` e `FE-IMP-011` implementam endpoints que em M3 eram "client-only/optimistic sem
rollback". O desenvolvedor deve usar o backlog M5 (este) como fonte de verdade — não reutilizar
código de protótipos que fazia o ignore como client-only.

**Mitigação:** Documentado explicitamente em `FE-IMP-011` (WARNING M4 RESOLVIDO) e em
`FE-IMP-025` (cenário de rollback obrigatório).

---

## 6. Approval criteria por marco

| Marco | Critério |
|---|---|
| P1 done | `nx build cordele-web` sem erros; rota `/imp` ativa no shell |
| P3 done = **MVP shippável em dev** | T03 e T04 operacionais end-to-end; testes unitários passando |
| P4 done | Guards + empresa-switch + breadcrumb funcionando |
| P7 done = **Production Ready** | 18/18 e2e Playwright passando em CI; `nx build --configuration=production` sem erros |

---

## 7. Próxima ação

```
-> /fe-architect-scaffold cordele IMP
```

O scaffold (M6) cria a estrutura Nx de libs/apps a partir de `generator-config.yml`, promove os
componentes do protótipo BA e registra o projeto no `nx.json`. As issues deste plano alimentam
`fe-implement` a partir de M6.
