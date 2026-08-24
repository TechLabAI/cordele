# ADR-IMP-001 — Manuscript parse progress via a single synchronous POST (indeterminate indicator)

- **Status:** accepted (2026-08-24) — **rewritten** at M3 (FE Specs) to align with the authoritative
  backend contract. This ADR previously proposed a `POST → {parseJobId} → GET polling` flow; that
  variant is **rejected** (see §Alternatives). The file name is kept so existing cross-references
  (README index, doc 06 §R1/R2, doc 05 §2) resolve; the subject is now the synchronous indicator.
- **Scope:** module `imp` (Importação) — frontend only
- **Supersedes:** the polling assumption in doc 05 §2 ("Poll parse status") and doc 06 §R1/R2.
- **Driven by:** `docs/architecture/backend/services/imp-service/contracts/api-contract.md` §0 (D-A)
  and §7 — **the backend is authoritative on transport shape**.

## Context

Importing a manuscript is server work: the file bytes are uploaded and the `.docx`/`.md` is parsed
into a chapter/section/block content tree. The UI must keep the editor informed while the server
works, then land on Structure Review (T04) with the parse result.

At the Vision phase the FE assumed the parse would be asynchronous (a `parseJobId` plus a polling
loop), because there is **no messaging bus** for the frontend (`messaging.enabled=false`) and hence
no push channel. The backend, however, resolved the transport differently and is authoritative:

> **api-contract.md §0, decision D-A — parse is SYNCHRONOUS in the request cycle.**
> `POST /api/imp/manuscripts` parses the file inside the request and returns the fully parsed,
> persisted `Manuscrito` (content tree included) in the **same** `201 Created` response. There is
> **no** `parseJobId`, **no** `202 Accepted`, and **no** parse-status polling endpoint. With no
> broker there is nowhere to offload to, and the 50 MB cap plus streamed parsing bound the request.

The prototype fakes progress with a fixed local timer. Production must reflect the real, single
round-trip: one request whose completion **is** the readiness signal.

## Decision

The Import flow issues **one synchronous `POST /api/imp/manuscripts`** and treats its response as
the readiness signal. There is **no polling loop and no `parseJobId`**. Driven from `ImportFacade`:

1. `POST /api/imp/manuscripts` (`multipart/form-data`: `file` + **exactly one** of
   `projetoTitulo` | `projetoId` — see api-contract §0 D-C). The request stays in flight for the
   whole upload+parse duration.
2. The UI models a two-phase indicator on the **same** in-flight request:
   - **Upload phase** — a determinate `%` bar driven by `HttpClient` upload progress events
     (`reportProgress: true`, `observe: 'events'`), while bytes are still transferring.
   - **Parse phase** — once the request body has finished uploading (upload events reach 100%) but
     the response has not yet arrived, switch to an **indeterminate** "analisando estrutura…"
     indicator (parse time is not linear and the server sends no intermediate signal).
3. On `201 Created`, the facade reads the response body (`ManuscritoDetail`, including `estrutura`),
   **hydrates `ReviewFacade` directly from it**, and navigation advances to
   `/revisao-de-estrutura`. **No follow-up `GET` is required** on the happy path.
4. On a non-2xx `ProblemDetail`, the facade moves to an explicit `error` state with a "Reimportar"
   affordance (see SPEC-07 for the per-code mapping).

`GET /api/imp/manuscripts/{id}` (and `/estrutura`) remain in the contract, but **only** for
**reload / deep-link / resume / T04 hydration on a fresh page load** — a plain resource read, never
a readiness probe and never a polling target. If T04 is entered without in-memory state (direct URL,
refresh), `ReviewFacade` performs a **single** `GET` to hydrate.

The single request is scoped to the active empresa (`X-Empresa-Id` via the shared interceptor) and
is cancelled on empresa switch or when leaving the flow.

## Alternatives considered

1. **`POST → {parseJobId} → GET polling` (the original proposal of this ADR)** — **rejected.** The
   backend contract (D-A) does not expose a `parseJobId`, a `202`, or a status endpoint; there is no
   server resource to poll for readiness. Building a client poll loop against a synchronous endpoint
   would be fiction. Retained here only as the record of what changed.
2. **WebSocket / SSE push from `imp-service`** — rejected: no messaging/streaming infrastructure is
   enabled (`messaging.enabled=false`); disproportionate for a low-frequency import action.
3. **Fake fixed-timer progress (as in the prototype)** — rejected: not server-truthful; would route
   to T04 before the parse actually finished, breaking the "nothing disappears without warning"
   guarantee when counts are not yet known. Replaced by the real request lifecycle above.

## Consequences

- **Positive:** exactly one round-trip; the response **is** the parse result, so T04 hydrates with
  zero extra requests and no completion-latency window; no poll cadence, backoff, or timeout to tune;
  works over plain HTTP through the existing Access Layer.
- **Negative:** the request is long-lived for large files — the client must set a **generous
  per-request timeout** (aligned with the server's parse budget for a 50 MB file, e.g. ~120 s) and
  must not let a default interceptor/proxy timeout abort it. The parse phase shows no linear
  progress (indeterminate by nature).
- **Mitigations:** client-side pre-validation (extension ∈ `{.docx,.md}`, size ≤ 50 MB) rejects bad
  files before the request; a hard client timeout maps to the same `error` state as a `5xx` with a
  "Reimportar" affordance; the indeterminate phase carries explicit expectation copy
  ("Isto pode levar até alguns minutos para manuscritos grandes."); the request is cancelled on
  empresa switch / navigation-away so a stale parse never hydrates the wrong tenant.

## References

- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` §0 (D-A, D-C), §4.1, §7
- `../05-state-and-data-flow.md` (§2 data access, §5 error handling — the polling row is superseded)
- `../02-architecture-blueprint.md` (§3 flows)
- `../frontend-spec/SPEC-04-data-access.md` (upload operation + progress event stream)
- `../frontend-spec/SPEC-07-error-handling.md` (ProblemDetail → AppError mapping)
- `docs/architecture/frontend/standards/access-layer-contracts.md`
