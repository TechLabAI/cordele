<!-- OUTPUT-SCHEMA
- Riscos
- Gaps Conhecidos
- Suposicoes a Validar
- Dependencias Criticas
-->

# 06 — Risks, Gaps and Assumptions

**Module:** PROJ — Projetos

## Riscos

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Status drift — another context writes `projeto_editorial.status` directly instead of calling `advanceTo`. | Two writers, inconsistent lifecycle, the core value of PROJ lost. | Single-writer invariant (local ADR-002 / D-C); no repository write of `status` exposed outside PROJ; port-only surface enforced in review and (future) ArchUnit-equivalent lint. |
| R2 | Illegal or out-of-order transition requests from IMP/PUB. | Project reaches an invalid state. | Legal-transition table in the `ProjectStatus` value object; typed rejection; idempotency for already-reached statuses. |
| R3 | Non-idempotent retries — an in-process `advanceTo` retried after partial failure double-applies. | Status regresses or emits duplicate events. | Idempotency invariant (advance to a reached/passed status = no-op); events emitted only on an actual change. |
| R4 | Publication-history read view drifts from PUB's records or couples PROJ to PUB internals. | Editor sees stale/incorrect history; hidden coupling. | History is read-only via `PublicationHistoryPort` (ADR-003); no duplicated rows; adapter isolates PUB's query contract. |
| R5 | Cross-context deletion / LGPD erasure of a project leaves orphaned manuscripts, binaries or publications. | Data-protection violation; storage leaks. | Define an orchestrated cascade with IMP/COMP/PUB before delete ships (gap G3); PROJ owns the entry point. |
| R6 | Multi-tenancy model mismatch between control plane (schema-per-tenant) and BA POC (single-tenant). | Wrong isolation assumptions baked into persistence. | Follow control-plane schema-per-tenant; flag as assumption A1 to confirm before scaffold. |
| R7 | In-process coupling with no broker means IMP/PUB and PROJ deploy as one unit; a slow PROJ call blocks the caller. | Reduced independence; latency coupling. | Acceptable in the modular-monolith POC (local ADR-001); async path kept open behind the same ports (A5). |

## Gaps Conhecidos

- **G1 — Status-change audit.** Whether to persist a full `from/to/requestedBy/changedAt` log (beyond
  `atualizadoEm`) is undecided; defer to Specs based on auditability needs.
- **G2 — Publication-history contract.** The exact shape of `PublicationHistoryPort` (fields returned per
  `Publicacao`, ordering, download-link resolution) is defined with PUB at the Specs phase.
- **G3 — Cross-context deletion / LGPD erasure.** The cascade from a deleted `ProjetoEditorial` to IMP,
  COMP and PUB data (rows + binaries) is not yet designed.
- **G4 — Project detail composition.** How detail aggregates the manuscript summary (IMP) alongside PROJ
  status and PUB history — one composing use case vs. multiple reads — is a Specs decision.
- **G5 — Library pagination/filtering.** Whether the library needs pagination, status filters or search
  at POC scale is unquantified.
- **G6 — Revision semantics.** The `publicado → em_composicao` (new revision) and `com_erros →
  em_composicao` (recovery) paths need concrete triggers agreed with COMP/PUB.
- **G7 — Tenant provisioning / per-schema migration** is a shared platform mechanism (Prisma vs
  schema-per-tenant) not yet designed; noted for scaffold/infra.

## Suposicoes a Validar

- **A1** — Multi-tenancy is schema-per-tenant multi-empresa (`cordele_global` + `emp_<slug>`), per the
  control plane, overriding the BA POC single-tenant simplification. **Confirm before scaffold.**
- **A2** — PROJ is the sole writer of project status; IMP and PUB call `AdvanceProjetoStatusUseCase` and
  never write `projeto_editorial` (D-C).
- **A3** — `advanceTo` is idempotent: advancing to an already-reached/passed status is a successful no-op.
- **A4** — Publication history is read from PUB's `Publicacao` records via an in-process port; PROJ owns
  no publication table (ADR-003).
- **A5** — Lifecycle operations run synchronously in-process; no broker (`messaging.enabled = false`);
  PROJ's domain events are in-process only.
- **A6** — The status set is exactly `{rascunho, em_composicao, publicado, com_erros}` (data-model
  `ProjetoEditorial.status`); no additional POC states.
- **A7** — `Editora` is a global-registry reference resolved by Projects, not owned/created here in the
  POC.
- **A8** — No AI and no external API participate in Projects (`ai.hasAi = false`).

## Dependencias Criticas

- **PostgreSQL 16 + Prisma** — persistence of `ProjetoEditorial` and tenant-schema targeting.
- **`EmpresaContext` / RULE-07** — tenant propagation; without it, tenant isolation cannot be enforced on
  create/advance/read.
- **Import (IMP)** — calls `advanceTo({ em_composicao })` after a manuscript is imported; references but
  does not own the project.
- **Publication (PUB)** — calls `advanceTo({ publicado | com_erros })` after an export, and is the source
  of the publication-history read view.
- **BFF (NestJS)** — the sole entry point for editor-facing create/list/detail (TECH-003).
