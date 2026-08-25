# SPEC-07 — Error Handling — COMP (Composição) — Frontend

> Maps `comp-service` `ProblemDetail` (RFC 7807) → normalized `AppError` → user-facing feedback. URNs and
> HTTP codes are authoritative from `api-contract.md` §5. The ErrorNormalize interceptor
> (`@cordele/shared/access-http-base`) converts each `problem+json` into `AppError { code, title, detail,
> correlationId }`; `correlationId`/`traceId` mirrors `X-Correlation-Id`.

## 1. `ProblemDetail` → `AppError` → UI

| BE URN (`type`) | HTTP | Where it surfaces | UI treatment | Copy (pt-BR) |
|---|---|---|---|---|
| `urn:cordele:comp:validation` | 400 | `PUT` metadados / layout | **defensive** (client pre-validates §7.1/§7.2); inline field errors if hit | "Verifique os campos destacados." |
| `urn:cordele:comp:unauthorized` | 401 | any call | session expired → route to login (handled by shell) | — (redirect) |
| `urn:cordele:comp:forbidden` | 403 | any write | access-denied banner replacing content (pre-empted by `comp.edit` gating) | "Você não tem permissão para editar esta composição." |
| `urn:cordele:comp:projeto-not-found` | 404 | any call (stale/cross-empresa id) | route to "Projeto não encontrado", link back to library (pre-empted by `compProjetoGuard`) | "Projeto não encontrado." |
| `urn:cordele:comp:manuscript-missing` | 409 | `GET .../preview-context` | preview **empty state** ("nada para pré-visualizar"); style panel stays usable | "Ainda não há manuscrito para pré-visualizar." |
| `urn:cordele:comp:cover-too-large` | 413 | `POST .../capa` | inline drop-zone error with the size limit; rest of the form unaffected | "A capa excede 10 MB." |
| `urn:cordele:comp:unsupported-cover-format` | 415 | `POST .../capa` | inline drop-zone error with accepted formats | "Formato inválido. Use JPEG, PNG ou WebP." |
| `urn:cordele:comp:override-ref-not-found` | 422 | `PUT .../layout` | **defensive** (FE sends only preview-resolved refs; stale dropped); toast + keep edits | "Uma imagem referenciada mudou. Revise o layout." |
| `urn:cordele:comp:structural-edit-deferred` | 422 | `PUT .../layout` | **unreachable by construction** (toolbar alignment-only, FE never emits `tipo=em-branco`); defensive toast if hit | "Edição estrutural indisponível nesta versão." |
| (5xx / network) | 5xx | `GET` metadados / layout / preview-context | error state replacing the affected screen, "Tentar novamente" | "Não foi possível carregar. Tente novamente." |

## 2. Status gate is FE-only — no BE illegal-status error

The Vision draft (doc 05) anticipated a `409 urn:cordele:comp:illegal-status`. The contract has **no such
error** (api-contract §5): COMP writes are status-agnostic on the wire (COMP never asserts project status).
Preventing a deep-link into COMP for a non-`em_composicao` project is a **FE UX affordance** — `compStatusGuard`
redirects to PROJ (SPEC-01 §3) — not a backend rejection. There is therefore **no** `illegal-status` mapping.

## 3. Toast vs banner vs modal

| Channel | Used for |
|---|---|
| **Error state** (replaces content) | `GET` load failure (5xx/network) on metadata or layout — the primary content cannot render |
| **Empty state** (in-content) | `409 manuscript-missing` on the preview (nothing to preview yet) |
| **Banner** (in-content) | `403 forbidden`; `not-found` |
| **Inline** (field / drop zone) | `400 validation` field errors; cover `413`/`415` on the drop zone |
| **Toast** (transient) | defensive `422 override-ref-not-found` / `structural-edit-deferred` on export |
| **Modal** | not used in the MVP (no destructive confirm surfaced in T05/T06) |

## 4. Retry strategy

- **Reads** (metadata / layout / preview-context): no automatic retry; a manual "Tentar novamente" re-issues
  the request (idempotent `GET`). Re-entry to the route also re-fetches (ADR-COMP-001).
- **Cover upload**: no auto-retry; a `413`/`415` is terminal for that file — the drop zone invites a new file.
- **Advance / Export upsert**: no auto-retry; the upsert is idempotent so a manual retry is safe. Local edits
  are preserved across a failed save (pessimistic — nothing was navigated away from).

## Criterios de aceite (EARS)

- `IF the backend responds urn:cordele:comp:validation (400) on a metadata upsert, THEN THE SYSTEM SHALL surface inline field errors and SHALL NOT navigate away [comp-err-validation].`
- `IF the backend responds urn:cordele:comp:forbidden (403), THEN THE SYSTEM SHALL replace the content with an access-denied banner [comp-err-forbidden].`
- `IF the backend responds urn:cordele:comp:projeto-not-found (404), THEN THE SYSTEM SHALL route to the "Projeto não encontrado" state with a link back to the library [comp-err-not-found].`
- `IF the backend responds urn:cordele:comp:manuscript-missing (409) on the preview, THEN THE SYSTEM SHALL show the preview empty state and keep the style panel usable [comp-err-manuscript-missing].`
- `IF the backend responds urn:cordele:comp:unsupported-cover-format (415), THEN THE SYSTEM SHALL show an inline drop-zone error listing the accepted formats and leave the form intact [comp-err-cover-format].`
- `IF the backend responds urn:cordele:comp:cover-too-large (413), THEN THE SYSTEM SHALL show an inline drop-zone error stating the size limit and leave the form intact [comp-err-cover-size].`
- `IF the backend responds urn:cordele:comp:override-ref-not-found (422) on export, THEN THE SYSTEM SHALL surface a defensive toast and preserve the local edits [comp-err-override-ref].`
- `IF the backend responds urn:cordele:comp:structural-edit-deferred (422), THEN THE SYSTEM SHALL surface a defensive toast, this path being unreachable while the toolbar is alignment-only [comp-err-structural-deferred].`
- `IF a metadata, layout or preview read returns 5xx or a network error, THEN THE SYSTEM SHALL render an error state with a "Tentar novamente" retry [comp-err-read-5xx].`
- `WHEN any error is surfaced, THE SYSTEM SHALL attach the correlationId from the interceptor for support [comp-err-correlation].`
