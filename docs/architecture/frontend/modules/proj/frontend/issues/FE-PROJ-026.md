## [FE-PROJ-026] [INFORMATIONAL] Origem dos 15 cenários e2e "órfãos" — cobertura defensiva extra

**Status:** 🔲 INFORMACIONAL (sem implementação nova)
**GitHub:** [#TBD]

**Outcome:**
Esta issue documenta a origem e o propósito dos 15 cenários e2e que excedem as cláusulas EARS
diretas das SPECs. Não requer nova implementação — os comportamentos já estão cobertos pelos
testes unitários das facades e pelos cenários das specs Playwright (FE-PROJ-024, FE-PROJ-025).

**Context / Problem statement:**
- M4 handoff confirma: "FE Gate1 0 violações / 7 SPECs / 40 cláusulas; FE Gate2 40/40 cobertas
  (29 cenários; 15 órfãos = cobertura defensiva extra, não gaps)".
- Os 29 cenários de e2e foram gerados na fase M3 (fe-architect-specs-validate). O FE Gate2 mapeia
  cláusula SHALL → cenário e verificou que 29 cenários cobrem as 40 cláusulas. Os 15 cenários
  "além do EARS" são comportamentos defensivos documentados — não evidência de gaps de requisito.
- Sem esta issue, um desenvolvedor futuro pode interpretar "15 cenários sem mapeamento EARS" como
  "testes desnecessários" e removê-los — o que seria incorreto.

**Categorias dos 15 cenários defensivos (por tema):**
| # | Tema | Comportamento coberto | Feature |
|---|---|---|---|
| 1-3 | CLS / loading | Skeleton nunca renderiza estado `empty`; altura fixa dos cards | biblioteca |
| 4-5 | Race condition | Empresa muda durante loading → só o último request vence | biblioteca |
| 6-7 | Feature flag | `proj.quickDownload=off` oculta o botão sem deploy | biblioteca |
| 8-9 | Reopen idempotência | Segundo clique durante `reopenPending` é inerte | histórico |
| 10-11 | Badge edge cases | `ultimoEpubcheckStatus=null` + status `publicado` → `pending` | biblioteca |
| 12-13 | Retry URL | URL assinada expirada → re-minta no clique seguinte, sem cache | histórico |
| 14 | Correlação | `correlationId` presente em toda mensagem de erro | ambas |
| 15 | Degraded notice | Notice específico (não generic "N/A") para campos degradados | ambas |

**Por que manter estes cenários:**
- Todos os 15 previnem regressões em comportamentos que foram explicitamente escolhidos durante
  a fase de specs (SPEC-03/04/07 deliberations).
- O custo de manutenção é baixo: a maioria são variantes de cenários já implementados.
- O custo de perder estes comportamentos é alto: race conditions (4-5), CLS (1-3) e reopen
  idempotência (8-9) são difíceis de detectar por inspeção visual.

**Ação requerida:** nenhuma.

**Non-goals:**
- Não cria novas specs Playwright para os 15 (já cobertos por testes unitários e pelas specs FE-PROJ-024/025).
- Não altera nenhuma SPEC ou feature file.

**Layer(s):**
frontend / (documentação)

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-08-e2e-scenarios.md`
- `docs/architecture/frontend/modules/proj/frontend/e2e/biblioteca-de-projetos.feature`
- `docs/architecture/frontend/modules/proj/frontend/e2e/download-e-historico.feature`

**Architecture alignment:**
- Não aplicável (issue informacional)

**Implementation checklist (by file):**
- (nenhum arquivo a criar — issue de documentação de intenção)

**Tests**
- (nenhum novo — ver FE-PROJ-024 e FE-PROJ-025)

**Milestone:**
Wave 9 / P9 Informational

**Labels:**
type:informational
layer:frontend
scope:proj
priority:P9

**Acceptance criteria:**
- Esta issue é fechada quando FE-PROJ-024 e FE-PROJ-025 são concluídas e os 29 cenários passam.

**Dependencies:**
- FE-PROJ-024 (specs biblioteca)
- FE-PROJ-025 (specs histórico)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- (nenhum — informacional)

**Risks / Notes:**
- Se no futuro um desenvolvedor propuser remover algum dos 15 cenários "extras", consultar
  esta issue para entender a intenção arquitetural antes de decidir.
