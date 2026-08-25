## [FE-PUB-011] Error mapping — AppError URN → mensagem pt-BR + canal (SPEC-07)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/data-access/src/lib/errors/pub-error-map.ts` centraliza o mapeamento de cada URN de erro
de PUB (`urn:cordele:pub:*`) para: mensagem pt-BR, canal de exibição (banner/inline/modal/toast) e
se é retryável. traceId é extraído de AppError e passado para os componentes de erro.

**Context / Problem statement:**
- SPEC-07 §2 define a tabela exaustiva: 10 URNs + download expirado + 5xx.
- Veredito erros_criticos não é erro HTTP — é dado de domínio (SPEC-07 §1).
- traceId (X-Correlation-Id) anexado em todo erro renderizado (SPEC-07 §4).
- Bloqueia: FE-PUB-009, FE-PUB-010 (facades expõem AppError às views)

**Approach (execution path):**
1. Criar `libs/pub/data-access/src/lib/errors/pub-error-map.ts`:
   - `PUB_ERROR_MAP: Record<string, { message: string; channel: 'banner'|'inline'|'modal'|'toast'; retryable: boolean }>`
   - Cobrir todos os URNs de api-contract §5 conforme SPEC-07 §2
   - Fallback para 5xx: { message: 'Falha temporária. Tente novamente.', channel: 'banner', retryable: true }
2. Função helper `resolveError(appError: AppError): PubErrorUX` usada pelas facades.
3. Nunca mapear epubcheckStatus=erros_criticos como AppError.

**Non-goals:**
- Não implementa os componentes de exibição de erro (FE-PUB-024).
- Não inventa URNs além dos definidos em api-contract §5.

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` (§1, §2, §3, §4)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:data-access`
- URN é a chave estável de switch; nunca status code HTTP diretamente

**Implementation checklist (by file):**

**Lib: libs/pub/data-access**
- 🔲 `libs/pub/data-access/src/lib/errors/pub-error-map.ts`
- 🔲 `libs/pub/data-access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-data-access` PASS (cada URN mapeia para canal e mensagem corretos)
- 🔲 `nx lint pub-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P2

**Acceptance criteria:**
- `npx nx test pub-data-access` PASS
- Todos os URNs de api-contract §5 cobertos no PUB_ERROR_MAP
- manuscript-missing → banner + retryable:false
- 5xx → banner + retryable:true
- erros_criticos não está no error map (é dado de domínio)

**Dependencies:**
- INT-FE-PUB-001 (AppError shape do shared interceptor)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só mapeamento client-side)

**Testing / Evidence required:**
- Unit tests cobrem todos os URNs + fallback 5xx

**Risks / Notes:**
- Confirmar que ErrorNormalize de @cordele/shared/access-http-base é agnóstico ao namespace urn:cordele:pub: antes de fechar.
