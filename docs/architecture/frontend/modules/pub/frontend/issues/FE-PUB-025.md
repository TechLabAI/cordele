## [FE-PUB-025] Download gate — label "inválido", auto re-fetch URL expirada, ciclo de vida do signed-URL

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
PublicationHistoryRowComponent e ExportActionsBarComponent exibem corretamente o gate de download:
linhas com `erros_criticos`/sem arquivoUrl mostram label "inválido" e botão disabled; URL expirada
ou `401`/`404` dispara re-fetch automático com toast "gerando novo link"; segunda falha → inline error.

**Context / Problem statement:**
- SPEC-04 §4: ArtifactDownloadService re-busca signed URL em 401/404; fallback inline error.
- SPEC-07 §2 (download URL expired): inline row + toast "O link de download expirou. Gerando um novo link…".
- SPEC-03 §2: `podeBaixar = epubcheckStatus ∈ {valido, avisos}`; row "inválido" quando false.
- EARS pub-gate-download, pub-download-expired-refetch.

**Approach (execution path):**
1. Validar PublicationHistoryRowComponent (FE-PUB-020): botão disabled + label "inválido" quando !podeBaixar.
2. Em ArtifactDownloadService (FE-PUB-008): confirmar re-fetch automático em 401/404 + toast no 1o re-fetch.
3. Toast "O link expirou. Gerando um novo link…" via @cordele/shared/ui-feedback.
4. Inline error na segunda falha do re-fetch.

**Non-goals:**
- Não implementa o download em si (FE-PUB-008).

**Layer(s):**
frontend / libs/pub/ui + libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§4)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` (§2 download URL expired)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui` + `type:data-access`
- Gate de download é client-side; defesa em profundidade no servidor (409)

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 Validar gate disabled/label "inválido" em PublicationHistoryRowComponent
- 🔲 Toast de URL expirada integrado ao @cordele/shared/ui-feedback

**Lib: libs/pub/data-access**
- 🔲 Confirmar ciclo re-fetch em ArtifactDownloadService (FE-PUB-008)

**Tests**
- 🔲 `nx test pub-ui` PASS (erros_criticos row → label "inválido" + button disabled)
- 🔲 `nx test pub-data-access` PASS (401 signed URL → re-fetch; segunda falha → AppError inline)

**Milestone:**
Wave 7 / P7 UX Polish

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P7

**Acceptance criteria:**
- erros_criticos row: botão Baixar disabled, label "inválido"
- 401 on signed URL: toast exibido + re-fetch automático
- Segunda falha re-fetch: inline error (sem toast loop)

**Dependencies:**
- FE-PUB-008, FE-PUB-020

**Data impact:**
- Nenhum

**API / Contract impact:**
- GET §4.4 (re-fetch)

**Testing / Evidence required:**
- Spy: re-fetch chamado uma vez em 401; segunda chamada → AppError inline

**Risks / Notes:**
- Confirmar que o serviço de toast existe em @cordele/shared/ui-feedback.
