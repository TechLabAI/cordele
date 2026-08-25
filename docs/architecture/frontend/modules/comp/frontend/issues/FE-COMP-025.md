## [FE-COMP-025] Telemetria COMP — eventos de observabilidade via @cordele/shared/observability

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`CompShellIntegrationService` emite eventos de analytics/telemetria para as 3 transições
de navegação COMP: `metadata-opened` (entrada em T05), `layout-opened` (entrada em T06) e
`comp-exported` (export bem-sucedido para PUB). Eventos via `@cordele/shared/observability`
(sem messaging bus — doc 02 §5).

**Context / Problem statement:**
- SPEC-06 §2: `CompShellIntegrationService` "emits navigation breadcrumbs ... to the
  pipeline-event stream via the shared observability hook".
- Sem `messaging.enabled`, os eventos são emitidos via hook síncrono do observability shared.
- Os 3 eventos de navegação são suficientes para a métrica de funil COMP (início/fim do módulo).

**Approach (execution path):**
1. Em `CompShellIntegrationService`, injetar `ObservabilityService` de `@cordele/shared/observability`.
2. Expor 3 métodos: `trackMetadataOpened(projetoId)`, `trackLayoutOpened(projetoId)`,
   `trackCompExported(projetoId)`.
3. Chamar estes métodos dos smart components (FE-COMP-011, FE-COMP-014) ou das Facades
   (FE-COMP-008, FE-COMP-009) nos pontos de transição corretos.
4. Garantir que os eventos incluem `projetoId` e `correlationId`.

**Non-goals:**
- Não implementa `ObservabilityService` (shared).
- Não rastreia eventos granulares por campo (só transições de navegação).

**Layer(s):**
frontend / libs/comp/integration

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:domain`
- Sem messaging bus (doc 02 §5); hooks síncrono

**Implementation checklist (by file):**

**Lib: libs/comp/integration**
- 🔲 `comp-shell-integration.service.ts` (atualizado com track* métodos)

**Tests**
- 🔲 `nx test comp-integration` PASS — trackMetadataOpened/trackLayoutOpened/trackCompExported chamados nos eventos corretos
- 🔲 `nx lint comp-integration` PASS

**Milestone:**
Wave 8 / P8 Observability

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P8

**Acceptance criteria:**
- `npx nx test comp-integration` PASS
- 3 eventos emitidos nos pontos corretos de navegação
- Eventos incluem `projetoId`

**Dependencies:**
- FE-COMP-004 (CompShellIntegrationService), FE-COMP-008 (Facade T05), FE-COMP-009 (Facade T06)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em ObservabilityService; verificar 3 eventos emitidos com payload correto

**Risks / Notes:**
- Se `@cordele/shared/observability` ainda não existe, criar um stub no shared antes de implementar aqui; não criar a implementação real dentro do scope:comp.
