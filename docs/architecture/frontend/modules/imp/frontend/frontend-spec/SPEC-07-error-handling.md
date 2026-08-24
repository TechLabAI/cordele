# SPEC-07 — Error Handling — IMP (Importação) — Frontend

> BE returns RFC-7807 `application/problem+json`; the `ErrorNormalize` interceptor in
> `@cordele/shared/access-http-base` converts it to a normalized `AppError`
> (`{ type, title, status, detail, traceId }`). The `type` URN is the stable switch key. Every
> failure code below is taken from `api-contract.md` §5 — the FE does not invent codes.

## 1. `ProblemDetail` → `AppError` → user feedback

`AppError` is keyed on the URN `type`. The FE maps each to a channel (inline / toast / banner /
modal) and a pt-BR message. `traceId` is attached to every rendered error for support.

## 2. Failure-code table (authoritative, from api-contract §5)

| BE `type` (URN) | HTTP | Screen | Channel | pt-BR message |
|---|---|---|---|---|
| `urn:cordele:imp:unsupported-format` | 415 | T03 | inline (drop zone) | "Formato não suportado. Envie um arquivo .docx ou .md." |
| `urn:cordele:imp:file-too-large` | 413 | T03 | inline (drop zone) | "Arquivo acima do limite de 50 MB. Reduza o tamanho e tente novamente." |
| `urn:cordele:imp:invalid-project-binding` | 400 | T03 | inline (form) | "Informe um nome de projeto novo OU selecione um projeto existente — nunca ambos." |
| `urn:cordele:imp:projeto-not-found` | 422 | T03 | banner (progress card) | "O projeto selecionado não foi encontrado nesta empresa. Recarregue a lista e tente de novo." |
| `urn:cordele:imp:parse-failed` | 422 | T03 | banner (progress card) | "Não foi possível ler este manuscrito (arquivo corrompido ou ilegível). Reimportar." |
| `urn:cordele:imp:validation` | 400 | T03 | inline (form) | "Requisição inválida. Verifique o arquivo e os campos e tente novamente." |
| `urn:cordele:imp:unauthorized` | 401 | any | (interceptor) redirect to login | — (handled globally by the Access Layer) |
| `urn:cordele:imp:forbidden` | 403 | any | modal / 403 page | "Você não tem permissão para esta ação." |
| `urn:cordele:imp:not-found` | 404 | T04 | banner | "Manuscrito não encontrado nesta empresa." (deep-link/reload of a missing id) |
| *client timeout* (no server response) | — | T03 | banner (progress card) | "A análise demorou demais. Tente reimportar." (maps to the same state as 5xx) |
| *network / 5xx* | 5xx | T03/T04 | banner + retry | "Falha temporária. Tente novamente em instantes." |

## 3. Channel criteria (toast vs banner vs modal vs inline)

- **Inline (drop zone / form field):** pre-submit or field-scoped validation the editor can fix in
  place (415, 413, 400 binding/validation). Client-side validation should pre-empt 415/413 before any
  request; the server codes are the defensive backstop.
- **Banner (progress card):** an in-flight import failed (422 parse/projeto-not-found, timeout, 5xx,
  404 on T04). Shown on the progress/summary card with a **"Reimportar"** affordance that resets to
  `idle`.
- **Modal:** blocking authorization failure (403) and the **zero-chapters confirm warning** on T04
  (a confirm with `totalCapitulos === 0` opens a confirm modal before proceeding — doc 03 invariant).
- **Toast:** transient, non-blocking feedback — used for the **optimistic ignore rollback**
  ("Não foi possível ignorar o trecho — tente novamente"), only relevant once a server ignore
  endpoint exists (SPEC-04 §5 gap).

## 4. Retry strategy

- **Upload/import is not auto-retried** (it is a large multipart write; silent retries risk duplicate
  imports since each upload creates a new immutable manuscrito). Retry is **explicit** via
  "Reimportar", returning the VM to `idle`.
- **T04 hydration `GET`** (deep-link/reload) may auto-retry **once** on a transient `5xx`/network
  error with a short delay, then fall back to the error banner. It is idempotent, so a single retry
  is safe.
- **401** is handled globally (token refresh / re-login) by the Access Layer, not by IMP.
- Every error carries the interceptor `traceId`/correlation id for observability.

## Criterios de aceite (EARS)

- `IF the backend responds urn:cordele:imp:unsupported-format, THEN THE SYSTEM SHALL show an inline drop-zone error stating only .docx or .md are accepted [imp-unsupported-format].`
- `IF the backend responds urn:cordele:imp:file-too-large, THEN THE SYSTEM SHALL show an inline drop-zone error stating the 50 MB limit [imp-file-too-large].`
- `IF the backend responds urn:cordele:imp:invalid-project-binding, THEN THE SYSTEM SHALL show an inline form error instructing the editor to supply a new project name or an existing project, not both [imp-invalid-binding].`
- `IF the backend responds urn:cordele:imp:projeto-not-found, THEN THE SYSTEM SHALL show a banner on the progress card and keep the entered file so the editor can retarget the project [imp-projeto-not-found].`
- `IF the backend responds urn:cordele:imp:parse-failed, THEN THE SYSTEM SHALL show a banner with a "Reimportar" affordance and SHALL NOT navigate to structure review [imp-parse-failed].`
- `IF the backend responds urn:cordele:imp:forbidden, THEN THE SYSTEM SHALL show a blocking permission message and SHALL NOT retry [imp-forbidden].`
- `IF the backend responds urn:cordele:imp:not-found when hydrating structure review, THEN THE SYSTEM SHALL show a not-found banner and offer to return to the project library [imp-not-found].`
- `IF the upload request times out with no server response, THEN THE SYSTEM SHALL show the same retryable banner as a 5xx and SHALL NOT auto-retry the upload [imp-timeout].`
- `WHEN any IMP request fails, THE SYSTEM SHALL attach the correlation traceId to the rendered error [imp-trace-id].`
- `IF the editor confirms a structure with zero chapters, THEN THE SYSTEM SHALL open a confirmation modal before proceeding [imp-zero-chapters].`
