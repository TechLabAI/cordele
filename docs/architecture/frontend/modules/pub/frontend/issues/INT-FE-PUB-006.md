## [INT-FE-PUB-006] EmpresaContext / empresa switch — cancelamento de poll ativo

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Quando o usuário troca de empresa durante uma exportação em andamento (T07 fase `gerando`),
`PubShellIntegrationService.empresaChanged` dispara, `ExportFacade.stopPoll()` é chamado
imediatamente, e nenhuma chamada ao endpoint de status da empresa anterior é feita após a troca.

**Context / Problem statement:**
- SPEC-06 §2: PubShellIntegrationService expõe `empresaChanged` signal para ExportFacade.
- SPEC-04 §2 (cancellation): poll torn down on empresa switch — sem vazamento de requests.
- EARS: pub-empresa-cancel.
- Sem este mecanismo, o poll pode retornar dados de empresa errada (violação de isolamento multi-tenant).

**Approach (execution path):**
1. Validar que `PubShellIntegrationService.empresaChanged` emite quando EmpresaContext.activeEmpresa muda (FE-PUB-006).
2. Em ExportFacade (FE-PUB-009): assinar `empresaChanged`; em cada emissão chamar `stopPoll()`.
3. Testar que após empresa switch: nenhuma chamada GET §4.2 é emitida com publicacaoId da empresa anterior.

**Non-goals:**
- Não implementa o seletor de empresa (responsabilidade do Shell/shared).

**Layer(s):**
frontend / libs/pub/data-access + libs/pub/integration

**Bounded context:**
pub ↔ shared/empresa-context

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§2 cancellation)

**Milestone:**
Wave 4 / P4 Hub Integrations

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4

**Acceptance criteria:**
- Empresa switch durante poll → stopPoll() chamado imediatamente
- Nenhum request GET §4.2 emitido após empresa switch com publicacaoId anterior
- poll não reinicia automaticamente para a nova empresa (nova exportação explícita necessária)

**Dependencies:**
- FE-PUB-006 (PubShellIntegrationService.empresaChanged), FE-PUB-009 (ExportFacade.stopPoll)

**Risks / Notes:**
- Confirmar que EmpresaContext emite em toda mudança de empresa (incluindo logout/re-login com empresa diferente).
