<!-- OUTPUT-SCHEMA
- Riscos
- Gaps Conhecidos
- Suposicoes a Validar
- Dependencias Criticas
-->

# 06 — Risks, Gaps and Assumptions

**Module:** PUB — Publicação

## Riscos

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | epubcheck (Java) unavailable, wrong version, or slow in the runtime environment | Builds cannot be validated → no publication can reach `publicado` | Pin the epubcheck version; run behind `EpubValidationPort` with a health check at startup; fail the build to `com_erros` with a clear operational error rather than hanging |
| R2 | Assembled ePub passes the builder but epubcheck rejects it (spec gaps in the assembler) | Editors see `com_erros` they cannot fix upstream (the fault is ours, not the content's) | Distinguish content errors from assembler errors in the report; treat assembler-caused failures as defects, not editor-actionable outcomes; golden-file tests over the OPF/nav output |
| R3 | Long or memory-heavy builds for large books block the worker or exhaust resources | Slow or failed publications; noisy-neighbour across tenants | Bounded per-job timeout and working directory; single non-terminal build per project; stream/pack incrementally; cap manuscript size upstream (IMP ≤ 50 MB) |
| R4 | `PROJ.advanceTo` succeeds but the local `Publicacao` commit fails (or vice versa) — cross-context inconsistency | Project status and publication record disagree | Order operations so the `Publicacao` is committed before `advanceTo`; `advanceTo` is idempotent, so a retry reconciles; reconciliation reads PUB's records as the source of truth for attempts |
| R5 | Duplicate/concurrent triggers start two builds for one project | Wasted work, conflicting artifacts, race on status | "At most one non-terminal `Publicacao` per project" invariant; re-trigger returns the in-flight `publicacaoId` (ADR-002) |
| R6 | Stale reads: metadata/layout/manuscript change after a build started | Published ePub reflects an inconsistent snapshot | Read all inputs at the start of the job within one logical read; the attempt records the inputs' state; a later change is a new attempt |
| R7 | Synchronous in-process coupling to IMP/COMP/PROJ | A failure in a peer fails the build | Accepted in the modular-monolith POC (ADR-001); ports isolate the blast radius; peer failures resolve the build to `com_erros`, not a stuck job |
| R8 | Artifact storage fills up (every attempt kept) | Disk/quota exhaustion over time | Retention policy deferred (A3); reference-only in DB; storage scoped per tenant so quota is attributable |

## Gaps Conhecidos

- **Artifact retention / pruning policy** is undefined — the POC keeps every successful `.epub`.
- **Report presentation**: mapping raw epubcheck codes to editor-friendly, actionable guidance is not
  specified; the MVP surfaces the raw report.
- **Cover/image handling edge cases** (missing `capaUrl`, oversized images, unsupported formats) at
  assembly time need concrete rules in Specs.
- **Partial validity** (warnings-only) — the policy is "warnings do not block `publicado`", but the exact
  severity threshold is to be confirmed in Specs.
- **Download authorization** beyond tenant scoping (per-user permissions) is not modelled (aligns with
  PROJ's "no fine-grained permissions in MVP").

## Suposicoes a Validar

- **A1** — epubcheck is available as a bundled, version-pinned tool in every environment that runs the
  build worker (child-process invocation is acceptable for the POC).
- **A2** — COMP always exposes complete-enough metadata (required: `titulo`, `autor`, `idioma`) and a
  layout config by the time a project is eligible to publish; missing required metadata is a validation
  failure, not a crash.
- **A3** — Keeping every artifact is acceptable for the POC; a retention policy is a post-POC operational
  decision.
- **A4** — Polling is an acceptable UX for build status in the POC (no push channel, `messaging.enabled =
  false`).
- **A5** — Only ePub 3 is required; PDF and other formats are explicitly post-MVP and will be new
  contexts/adapters, not a change to this domain.
- **A6** — In-process assembly (no external rendering/build service) is sufficient for the pilot's book
  sizes.

## Dependencias Criticas

- **epubcheck** (W3C validator) — the external authority that gates `publicado`; without it Publication
  cannot fulfil its core promise.
- **IMP** — `ManuscriptContentPort` (immutable content tree) as the body source.
- **COMP** — `GetMetadados` / `GetConfiguracaoLayout` as the identity + layout source.
- **PROJ** — `AdvanceProjetoStatusUseCase.advanceTo` to record `publicado` / `com_erros` on the project
  (D-C); PUB never writes `projeto_editorial`.
- **PostgreSQL 16 + Prisma** for the `Publicacao` aggregate; **`FileStoragePort`** backend for artifacts.
- **`EmpresaContext`** (AsyncLocalStorage) for tenant isolation of both records and stored files.
