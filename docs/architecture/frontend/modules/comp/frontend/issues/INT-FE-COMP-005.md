## [INT-FE-COMP-005] Integração @cordele/shared/access-decision — AccessDecisionService e permissões COMP

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`AccessDecisionService` de `@cordele/shared/access-decision` avalia corretamente as
permissões COMP (`comp.view`, `comp.edit`) e as feature flags (`comp.coverUpload`,
`comp.imageAlignment`). Nenhum componente COMP testa roles diretamente — todo o gating
passa pelo service.

**Context / Problem statement:**
- SPEC-05 §2: `THE SYSTEM SHALL evaluate every COMP permission through AccessDecisionService
  and SHALL NOT test roles directly in components`.
- `accessGuard('comp.view')` na rota usa o mesmo service.
- CoverDropZoneComponent usa `AccessDecisionService.has('comp.coverUpload')` (flag check).
- Sem esta integração, o gating de permissão/flag não funciona correctamente.

**Approach (execution path):**
1. Verificar que `@cordele/shared/access-decision` expõe `AccessDecisionService.has(perm)`
   e `AccessDecisionService.hasFlag(flag)` (ou API equivalente).
2. Registrar `COMP_PERMISSION_MAP` e `COMP_FEATURE_FLAGS` com o service (se necessário).
3. Testar que `comp.edit=false` → affordances de escrita ocultas/desabilitadas em T05 e T06.
4. Testar que `comp.coverUpload=off` → drop zone não renderizada.
5. Testar que `comp.imageAlignment=off` → badge não renderizado.

**Non-goals:**
- Não implementa `AccessDecisionService` (shared).
- Não modifica o mecanismo de JWT/claims.

**Layer(s):**
frontend / libs/comp/* (integração com @cordele/shared/access-decision)

**Bounded context:**
comp ↔ shared

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§2, §3)

**Milestone:**
Wave 4 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- `comp.edit=false` → advance, export, cover, alignment affordances ocultos/desabilitados
- Flags `comp.coverUpload=off` e `comp.imageAlignment=off` ocultam os componentes respectivos
- Nenhum componente COMP verifica roles diretamente

**Dependencies:**
- FE-COMP-001 (permission-map e feature-flags registrados)

**Risks / Notes:**
- Se `AccessDecisionService` ainda não suporta feature flags (só permissões), verificar como integrar as flags de COMP antes de implementar `CoverDropZoneComponent` (FE-COMP-013).
