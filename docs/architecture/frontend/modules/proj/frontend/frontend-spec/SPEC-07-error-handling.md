# SPEC-07 — Error Handling — PROJ (Projetos) — Frontend

> Maps `proj-service` `ProblemDetail` (RFC 7807) → normalized `AppError` → user-facing feedback. URNs and
> HTTP codes are authoritative from `api-contract.md` §5. The ErrorNormalize interceptor
> (`@cordele/shared/access-http-base`) converts each `problem+json` into `AppError { code, title, detail,
> correlationId }`; `correlationId`/`traceId` mirrors `X-Correlation-Id`.

## 1. `ProblemDetail` → `AppError` → UI

| BE URN (`type`) | HTTP | Where it surfaces | UI treatment | Copy (pt-BR) |
|---|---|---|---|---|
| `urn:cordele:proj:unauthorized` | 401 | any call | session expired → route to login (handled by shell) | — (redirect) |
| `urn:cordele:proj:forbidden` | 403 | list / detail / history | access-denied banner replacing content (pre-empted by guard) | "Você não tem acesso a este projeto." |
| `urn:cordele:proj:not-found` | 404 | detail / history deep-link (stale/cross-empresa id) | `not-found` state, link back to library | "Projeto não encontrado." |
| `urn:cordele:proj:artifact-not-available` | 409 | download of `erros_criticos`/`pendente` | **defensive** (affordance not rendered); inline row feedback if hit | "Esta versão não tem arquivo para baixar." |
| `urn:cordele:proj:illegal-status-transition` | 409 | reopen from `rascunho` | **defensive** (CTA hidden unless `publicado`/`com_erros`); toast if hit | "Este projeto ainda não pode ser reaberto." |
| `urn:cordele:proj:erasure-failed` | 502 | delete (UI deferred) | toast; project remains (recoverable) | "Não foi possível excluir o projeto. Tente novamente." |
| `urn:cordele:proj:validation` | 400 | reopen (unknown target) | defensive toast | "Ação inválida." |
| (5xx / network) | 5xx | list / detail / history | error state replacing the grid/list, "Tentar novamente" | "Não foi possível carregar. Tente novamente." |
| (signed URL 404 / expired) | 404 | download click | inline row feedback; re-request URL on retry | "Não foi possível baixar — tente novamente." |

## 2. Partial degradation (`degraded:true`) — not an error

A cross-context read port (IMP / COMP / PUB) being down is **degradation, not failure** (api-contract
§4.2/§4.3): the endpoint still returns each project's own identity + status with `degraded:true` and the
missing fields nulled. The UI:

- keeps the library/detail rendered;
- shows a subtle inline "temporariamente indisponível" marker on the affected fields (counters, author,
  `ultimoEpubcheckStatus`, publication history);
- never converts a `degraded:true` response into the `error` state.

## 3. Toast vs banner vs modal

| Channel | Used for |
|---|---|
| **Error state** (replaces content) | list/history load failure (5xx/network) — the primary content cannot render |
| **Banner** (in-content) | `403 forbidden` access-denied; `not-found` |
| **Inline** (row/field) | download failure; `degraded` field markers |
| **Toast** (transient) | defensive `409`/`400` on reopen; `502` erasure failure |
| **Modal** | not used in the MVP (no destructive confirm surfaced in T02/T08) |

## 4. Retry strategy

- **Reads** (list/detail/history): no automatic retry; a manual "Tentar novamente" re-issues the request
  (idempotent GET). Re-entry to the route also re-fetches (ADR-PROJ-001).
- **Download**: the signed URL is minted per click; on a `404`/expired, the retry simply re-requests a
  fresh signed URL (idempotent).
- **Reopen**: no auto-retry; a `409`/`400` is terminal for that click (the state did not change).

## Criterios de aceite (EARS)

- `IF the backend responds urn:cordele:proj:forbidden (403), THEN THE SYSTEM SHALL replace the content with an access-denied banner [proj-err-forbidden].`
- `IF the backend responds urn:cordele:proj:not-found (404), THEN THE SYSTEM SHALL render the "Projeto não encontrado" state with a link back to the library [proj-err-not-found].`
- `IF the backend responds urn:cordele:proj:artifact-not-available (409) for a download, THEN THE SYSTEM SHALL show inline row feedback and SHALL NOT change any state [proj-err-artifact].`
- `IF the backend responds urn:cordele:proj:illegal-status-transition (409) for a reopen, THEN THE SYSTEM SHALL surface a defensive toast and leave the visible status unchanged [proj-err-illegal-reopen].`
- `IF a list, detail or history read returns 5xx or a network error, THEN THE SYSTEM SHALL render an error state with a "Tentar novamente" retry [proj-err-read-5xx].`
- `IF a response carries degraded:true, THEN THE SYSTEM SHALL render the available identity and status and mark the missing fields "temporariamente indisponível" without entering the error state [proj-err-degraded].`
- `WHEN any error is surfaced, THE SYSTEM SHALL attach the correlationId from the interceptor for support [proj-err-correlation].`
