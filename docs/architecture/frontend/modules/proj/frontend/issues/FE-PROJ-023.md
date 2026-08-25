## [FE-PROJ-023] Telemetria — lifecycle events via @cordele/shared/observability

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ProjShellIntegrationService` emite eventos de telemetria para o pipeline de observabilidade
do Cordelê: `module_activated`, `library_viewed`, `project_opened`, `version_downloaded`.
Os eventos carregam `correlationId` e `empresaId` (da sessão, não do header).

**Context / Problem statement:**
- SPEC-06 §2 menciona que o serviço "emits navigation breadcrumbs (library viewed, project opened,
  version downloaded) to the pipeline-event stream via the shared observability hook".
- Sem bus de mensagens (doc 02 §5): os eventos são emitidos pelo `ProjShellIntegrationService`
  e pelo hook de download (FE-PROJ-016) via `@cordele/shared/observability`.
- Os eventos NÃO devem incluir dados pessoais do usuário (apenas IDs de sessão e entidade).

**Approach (execution path):**
1. Em `ProjShellIntegrationService.register()`:
   - Emitir `module_activated` via `ObservabilityService.track('module_activated', { module: 'proj' })`.
2. Em `BibliotecaDeProjetosComponent`:
   - Emitir `library_viewed` na inicialização bem-sucedida (`status=ready`).
3. Em `DownloadEHistoricoComponent`:
   - Emitir `project_opened` na inicialização com `projetoId`.
4. No handler de download (`onQuickDownload` / `onDownload`):
   - Emitir `version_downloaded` com `publicacaoId` após URL resolvida (não antes — evita telemetria de falhas).
5. Garantir que `ObservabilityService` é mockável nos testes.

**Non-goals:**
- Não implementa o `ObservabilityService` (responsabilidade de `@cordele/shared/observability`).
- Não bloqueia a UI se o serviço de telemetria estiver indisponível (fire-and-forget).

**Layer(s):**
frontend / libs/proj/integration + libs/proj/feature-library + libs/proj/feature-history

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:domain`
- Fire-and-forget: erros no ObservabilityService não propagam para o fluxo principal

**Implementation checklist (by file):**

**Lib: libs/proj/integration**
- 🔲 `ProjShellIntegrationService` — emit `module_activated` no register()

**Lib: libs/proj/feature-library**
- 🔲 `BibliotecaDeProjetosComponent` — emit `library_viewed` quando `status=ready`

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent` — emit `project_opened` no init com `projetoId`

**Lib: libs/proj/feature-history + feature-library**
- 🔲 Emit `version_downloaded` após resolveDownloadUrl bem-sucedido

**Tests**
- 🔲 `nx test proj-integration` PASS — `register()` chama `ObservabilityService.track('module_activated')`
- 🔲 `nx test proj-feature-library` PASS — `status=ready` → `library_viewed` emitido (spy)
- 🔲 `nx lint proj-integration` PASS

**Milestone:**
Wave 7 / P7 Observability

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P7

**Acceptance criteria:**
- `npx nx test proj-integration` PASS
- `npx nx lint proj-integration` PASS
- 4 eventos de telemetria implementados (module_activated, library_viewed, project_opened, version_downloaded)
- Falha no ObservabilityService não quebra nenhum fluxo de usuário

**Dependencies:**
- FE-PROJ-005 (ProjShellIntegrationService)
- FE-PROJ-016 (download handler para version_downloaded)

**Data impact:**
- Nenhum PII nos eventos de telemetria (apenas IDs de entidade)

**API / Contract impact:**
- Nenhum (telemetria é client-side fire-and-forget)

**Testing / Evidence required:**
- Spy em `ObservabilityService.track` verifica 4 events; nenhum contém email ou nome de usuário

**Risks / Notes:**
- Se `@cordele/shared/observability` ainda não existir, criar interface local `ObservabilityPort`
  e stub `NullObservabilityService`; ligar ao real quando o shared disponibilizar.
