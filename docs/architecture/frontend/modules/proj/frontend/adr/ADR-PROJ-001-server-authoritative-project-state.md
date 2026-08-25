# ADR-PROJ-001 — Project state is server-authoritative and re-fetched on (re)entry — no cross-module client cache

- **Status:** accepted (2026-08-25) · **confirmed against `api-contract.md` (M3, 2026-08-25)**
- **Scope:** module `proj` (Projetos) — frontend only
- **Driven by:** the cross-module ownership agreement — **`ProjetoEditorial` is owned by PROJ
  (D-C)**; sibling modules advance a project's status through backend ports
  (`AdvanceProjetoStatusUseCase.advanceTo`), and `messaging.enabled=false` means there is **no
  broker** to notify the SPA of those changes.

## Context

PROJ is the read-hub of Cordelê: the library (T02) lists every project of the empresa with its
status, and the history (T08) lists every `Publicacao` of a project. Both views are **derived from
state that other modules mutate**:

- IMP creates a `ProjetoEditorial` (`rascunho`) and advances it to `em_composicao` on confirm.
- COMP progresses composition; PUB writes a new `Publicacao` and can move the project to
  `publicado` / `com_erros`.

All of those mutations happen **outside PROJ** — on the backend, in-process, with no event reaching
the frontend (`messaging.enabled=false`, `ai.hasAi=false`). The prototype sidesteps this by reading
a static `mock-data.json`. Production must decide how the library and history stay truthful when the
editor returns from a sibling module having just changed a project's state.

Two obvious designs compete: keep a client-side cache of the project list (fast, but can be stale
and has **nothing to invalidate it**), or re-read from `proj-service` every time PROJ is entered
(one extra request, always correct).

## Decision

**Project state in PROJ is server-authoritative and PROJ re-fetches on (re)entry. There is no
cross-module client cache of the project list or the publication history.**

1. `LibraryFacade` issues `GET /api/proj/projetos` (empresa-scoped via `X-Empresa-Id`) **every time**
   `/biblioteca-de-projetos` is entered — including a return from IMP/COMP/PUB. The response is the
   source of truth for card status and counters.
2. `HistoryFacade` issues `GET /api/proj/projetos/{id}/publicacoes` **every time**
   `/download-e-historico` is entered, so a `Publicacao` just written by PUB appears immediately as
   "versão atual".
3. PROJ **never mutates** `ProjetoEditorial.status`. Status is read-only here; transitions are owned
   by IMP/COMP/PUB on the backend and observed by re-reading (no optimistic status update, nothing
   to roll back).
4. Handoffs to sibling modules carry `projetoId` as a route param only; PROJ holds no shared
   in-memory project store that another module could read or write.
5. The re-fetch is cancelled and re-issued on empresa switch (the library is empresa-scoped).

## Alternatives considered

1. **Client-side cache of the project list (signal store persisted across navigations)** —
   **rejected.** With no broker (`messaging.enabled=false`) there is no signal to invalidate it;
   a project advanced by IMP/COMP/PUB would show a stale status until a manual refresh, breaking the
   library's core promise of being truthful. The only correct invalidation trigger would be
   "on every return to PROJ" — which is exactly a re-fetch, so the cache buys nothing.
2. **A shared cross-module project store (e.g. `@cordele/shared/project-state`)** — rejected: it
   would duplicate the aggregate PROJ owns (D-C) on the client, invite two writers, and violate the
   Nx boundary that a module lib imports only `scope:<module>` + `scope:shared` domain contracts,
   not another module's mutable state.
3. **Push updates via SSE/WebSocket from `proj-service`** — rejected: no messaging/streaming
   infrastructure is enabled; disproportionate for a low-frequency, small-volume editorial library.

## Consequences

- **Positive:** the library and history are always correct on entry; no stale-cache class of bug; no
  invalidation logic to maintain; PROJ stays a pure reader of the aggregate it owns; boundaries clean.
- **Negative:** one list request per library entry (and one history request per history entry),
  including quick back-and-forth within PROJ; at POC volume (≤ ~20 projects) this is negligible.
- **Mitigations:** if a Spec later proves the extra requests hurt, add a **short-lived** cache scoped
  per empresa that is **invalidated on empresa switch and on return from any sibling module** — never
  a long-lived cross-module store. Skeleton cards keep the UI responsive during each re-fetch (CLS < 0.1).

## Reconciliation against the ratified contract (M3)

This ADR predates `proj-service/contracts/api-contract.md`; the FE Specs phase revalidated every clause
against it. **Result: confirmed, not contradicted** — the contract explicitly ratifies the decision:

- api-contract §8.4 states verbatim: *"FE `ADR-PROJ-001` (server-authoritative state) is confirmed by
  this contract: the SPA re-fetches on (re)entry to the library/detail; there is no cross-module cache
  (no broker to invalidate)."*
- The `advanceTo` port + fixed transition table (§7, D-D) confirm PROJ never accepts a client-driven
  status write; the SPA only reads status. Clause 3 stands unchanged.
- Two clauses are **refined** (not reversed) by the contract without weakening the decision:
  1. **Tenancy source.** The ADR/vision assumed empresa scoping via the `X-Empresa-Id` header; the
     contract (§2/§3) resolves the tenant **from the JWT `empresa` claim** and does not require that
     header. The re-fetch-on-entry decision is unaffected; clause 5 ("re-fetch on empresa switch") now
     means "re-fetch when the authenticated principal's empresa claim changes" (a new session/token),
     not "on a header flip". At POC volume (one editora per session) this is a no-op distinction.
  2. **PROJ is not fully write-free.** The ADR framed PROJ as a pure reader. The contract adds one
     editor-facing write — `POST /projetos/{id}/reopen` (§4.7) — surfaced by T08's "Ajustar metadados /
     layout". This does **not** violate the ADR: reopen is server-authoritative (the backend owns the
     transition table), pessimistic (await the `200 ProjetoDetail`), and the truthful state is still
     obtained by re-reading on return. No client-side status cache is introduced.

Net: ADR-PROJ-001 is **upheld**. No downgrade or rewrite; the two refinements are recorded here and
propagated to `05-state-and-data-flow.md` and the SPECs.

## References

- RAG evidence (cordele architecture): "ProjetoEditorial owned by PROJ (D-C): IMP calls ports, never
  writes projeto_editorial table"; "IMP→PROJ agreement: AdvanceProjetoStatusUseCase.advanceTo".
- `../05-state-and-data-flow.md` (§1 topology, §3 cache strategy, §6 navigation)
- `../02-architecture-blueprint.md` (§3 flows, §5 cross-cutting)
- `../../imp/frontend/05-state-and-data-flow.md` (§3 — coherent "call the API on each navigation" strategy)
- `docs/architecture/frontend/standards/access-layer-contracts.md`
- `docs/architecture/frontend/adr/ADR-006-module-entry-as-library.md`
