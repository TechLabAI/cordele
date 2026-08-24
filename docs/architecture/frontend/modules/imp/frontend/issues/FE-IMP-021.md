## [FE-IMP-021] Mapeamento de erros BE → UI (SPEC-07 failure codes)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todos os 11 códigos de falha de `api-contract.md §5` estão mapeados para canal + mensagem pt-BR
conforme SPEC-07 §2. O `ErrorNormalize` interceptor já entrega `AppError`; as facades e componentes
apenas consultam o `type` URN para decidir canal e mensagem.

**Context / Problem statement:**
- SPEC-07 §2 define a tabela completa: inline/drop-zone, banner/progress-card, modal, toast.
- O mapeamento deve ser centralizado (não duplicado em cada componente).
- Toast de ignore-rollback ("Não foi possível ignorar o trecho — tente novamente") é o único
  feedback via `@cordele/shared/ui-feedback` FeedbackService (para `imp-ignore-rollback`).
- Bloqueia: (nenhum — polish layer, mas afeta UX geral)

**Approach (execution path):**
1. Criar `libs/imp/data-access/src/lib/error/imp-error.mapper.ts` com função pura:
   `mapImpError(error: AppError): { channel: 'inline'|'banner'|'modal'|'toast', message: string }`.
2. Implementar mapeamento completo dos 11 URNs de SPEC-07 §2.
3. `ImportFacade` usa o mapper para popular `errorMessage` signal com a mensagem pt-BR.
4. `ReviewFacade` usa o mapper para o banner de erro em T04 e para o toast de rollback.
5. Erros de auth (401) são tratados pelo interceptor global — não mapeados no facade.
6. Adicionar `traceId` a cada mensagem renderizada (SPEC-07 "attach the correlation traceId").

**Non-goals:**
- Não re-implementa `ErrorNormalize` interceptor (pertence a `@cordele/shared/access-http-base`).
- Não cria componentes de erro novos (reusa canais existentes: inline do DropZone, banner do
  ProgressCard, toast do FeedbackService).

**Layer(s):**
frontend / libs/imp/data-access (mapper); libs/imp/feature-upload e libs/imp/feature-review (consumidores)

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-07-error-handling.md` (§2, §3, §4)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/error/imp-error.mapper.ts`
- 🔲 Integração do mapper em `ImportFacade` e `ReviewFacade`

**Tests**
- 🔲 `nx test imp-data-access` PASS:
  - `mapImpError` cobre todos 11 URNs
  - URN desconhecido → fallback genérico ('network / 5xx')
  - traceId presente no retorno
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 5 / P7 UX Polish

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P7

**Acceptance criteria:**
- `npx nx test imp-data-access` PASS
- `npx nx lint imp-data-access` PASS
- `npx nx build imp-data-access` PASS
- Todos 11 URNs mapeados sem default genérico para os conhecidos
- `traceId` incluído em toda mensagem renderizada

**Dependencies:**
- FE-IMP-010 (ImportFacade — usa mapper)
- FE-IMP-011 (ReviewFacade — usa mapper)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Depende de `AppError.type` e `AppError.traceId` do interceptor compartilhado

**Testing / Evidence required:**
- Teste unitário paramétrico com todos os URNs de SPEC-07 §2

**Risks / Notes:**
- Confirmar que `AppError` do shared contém `traceId` field; se não, usar `X-Correlation-Id` da
  resposta.
