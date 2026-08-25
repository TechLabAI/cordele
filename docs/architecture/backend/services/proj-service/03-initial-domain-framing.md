<!-- OUTPUT-SCHEMA
- Ubiquitous Language
- Aggregates and Entities
- Domain Events
- State Transitions
- Invariants
-->

# 03 — Initial Domain Framing

**Module:** PROJ — Projetos · **Bounded context:** Projects

## Ubiquitous Language

| Term | Meaning |
|---|---|
| Editorial Project (`ProjetoEditorial`) | The unit of work an editor manages: one title moving through the pipeline. Aggregate root of this context; owns the authoritative `status`. |
| Status (`status`) | The lifecycle state of a project: `rascunho`, `em_composicao`, `publicado`, `com_erros`. Set only by PROJ. |
| Transition | A change from one status to another; legal only if allowed by the transition table. |
| Advance (`advanceTo`) | A *request* by another context (IMP, PUB) for PROJ to move a project to a target status; validated and idempotent. |
| Library (biblioteca) | The tenant's list of editorial projects with their current status (screen T01). |
| Publication History | The read-side view of every ePub export of a project, assembled from PUB's `Publicacao` records (screen T07). |
| Editora | The publishing house — the tenant that owns the project (registry in `cordele_global`). |
| Manuscript (`Manuscrito`) | The imported source, referenced by a project; owned by Import (IMP). |
| Publication (`Publicacao`) | A record of one ePub export with its epubcheck outcome; owned by Publication (PUB), read here. |

## Aggregates and Entities

**Aggregate root: `ProjetoEditorial`** (owned by Projects)

- `id` (pk), `editoraId` → `Editora` (tenant, `cordele_global`)
- `nome` — project / title name
- `status` — `ProjectStatus` value object (`rascunho | em_composicao | publicado | com_erros`)
- `criadoEm`, `atualizadoEm` — timestamps
- (optional POC field) `descricao` — short project description

Value objects inside the aggregate:

- `ProjectStatus` — the status enum plus the **legal-transition table** (which statuses are reachable
  from which); the single place lifecycle rules live.

Referenced from outside the boundary (not owned here): `Manuscrito` (IMP), `Metadados` /
`ConfiguracaoLayout` (COMP), `Publicacao` (PUB), `Editora` (global registry). The publication-history
view is composed from `Publicacao` at read time, not stored as a PROJ entity (ADR-003).

## Domain Events

- **`ProjectCreated` (anchor event)** — raised when a `ProjetoEditorial` is persisted in `rascunho`.
  Payload: `projetoId`, `editoraId`, `nome`, `criadoEm`. It anchors every downstream manuscript,
  composition and publication that will reference this project.
- **`ProjectStatusChanged`** — raised after a legal transition is applied. Payload: `projetoId`,
  `from`, `to`, `requestedBy` (the calling context, e.g. `IMP`/`PUB`), `changedAt`.

Both are past-tense facts, dispatched via the in-process NestJS event emitter (`messaging.enabled =
false`; no broker). They are same-process notifications, not a cross-process delivery guarantee.

Note the direction of coupling: PROJ does **not** subscribe to IMP/PUB events to change status. Instead
IMP and PUB *call* PROJ's `AdvanceProjetoStatusUseCase` inbound port (D-C); PROJ's own events are for
interested in-process listeners (e.g. UI/read-model refresh), not for driving the lifecycle.

## State Transitions

The `ProjetoEditorial` lifecycle (the core of this context):

```
(none) --create--> rascunho                                   [ProjectCreated]
rascunho --advanceTo(em_composicao)--> em_composicao          [IMP: ManuscriptImported]
em_composicao --advanceTo(publicado)--> publicado             [PUB: epubcheck valido|avisos]
em_composicao --advanceTo(com_erros)--> com_erros             [PUB: epubcheck erros_criticos]
com_erros --advanceTo(em_composicao)--> em_composicao         [recovery: new compose/export cycle]
publicado --advanceTo(em_composicao)--> em_composicao         [new revision of an already-published title]
```

Rules applied by `AdvanceProjetoStatusUseCase`:

- Only transitions in the table are allowed; anything else is rejected with a typed error.
- **Idempotency:** requesting a status the project has already reached or passed is a no-op that returns
  success (so a retried in-process call from IMP/PUB never regresses status).

## Invariants

1. **Single writer of status.** Only PROJ mutates `ProjetoEditorial.status`; other contexts request via
   `advanceTo` and never write the table (D-C).
2. **Legal transitions only.** `status` only ever changes along an edge of the transition table; illegal
   requests leave it unchanged.
3. **Idempotent advance.** `advanceTo(target)` where the project already reached/passed `target` is a
   safe no-op.
4. **Tenant ownership.** Every project belongs to exactly one `Editora`; `editoraId` is set at creation
   and never reassigned; all access is `EmpresaContext`-scoped.
5. **Identity precedes work.** A `ProjetoEditorial` must exist before a manuscript can be imported to it;
   IMP references, it does not create, the project.
6. **History is derived.** The publication history reflects PUB's `Publicacao` records at read time;
   PROJ stores no duplicate publication rows (ADR-003).
7. **Auditable change.** Every applied transition records `from`, `to` and the requesting context.
