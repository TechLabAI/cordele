<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-004 — Source of the EpubSummaryVM KPI fields (Tamanho/Páginas/Capítulos/Imagens)

## Status
accepted (2026-09-01) · Scope: the Publication (PUB) context of Cordelê · Closes PUB-021 / `api-contract.md`
§0 open point (doc 06 M1/M1.5 handoff) · Unblocks `INT-FE-PUB-005` (FE)

## Contexto
The T07 KPI grid (`EpubSummaryGridComponent` / `EpubSummaryVM`, SPEC-03 §3) shows four tiles —
Tamanho/Páginas/Capítulos/Imagens — for a **valid export**. The prototype hardcoded these; they were
correctly dropped at promotion (FE-PUB-012), leaving no source field in `PublicacaoStatus` (§6.1) or
`PublicacaoHistoryItem` (§6.2). The FE already degrades correctly (tile omitted, never fabricated —
EARS `pub-kpi-omit-missing`); this ADR closes the contract gap, not a FE bug.

Forces: `.epub` bytes are never in the DB (only `artefato_ref`, ADR-003) — file size is not free; ePub
reflowable content has no fixed pagination — "páginas" is not a real, stable quantity; chapter/image
**counts** already exist on the manuscript side (`imp-service.manuscrito.total_capitulos` /
`total_imagens`), but `pub-service` does not read them today; `publicacao` is an **append-only** history
row (one per attempt) — a KPI shown against an old row must reflect the manuscript *as it was at that
build*, not its current state.

A key observation from `integration-contracts.md` §2.1: PUB already imports `ManuscriptContentPort`
(from IMP, in-process DI) at export time and **walks the full content tree** (`estrutura`) to emit the
XHTML content documents, spine and nav. That walk already visits every chapter and every image block —
counting them is a byproduct of work PUB already does, not a new read.

## Decisão
**Tamanho, Capítulos and Imagens are a build-time snapshot persisted on `publicacao`; Páginas is
permanently omitted (not a BE contract field, ever).**

1. **Capítulos / Imagens — counted during the existing `ManuscriptContentPort` walk**, not read from
   IMP's `total_capitulos`/`total_imagens` and not a new cross-context port. The `EpubBuilder` already
   traverses `estrutura` chapter-by-chapter, block-by-block; it accumulates chapter and image-block
   counts as it goes. **No new inbound/outbound port is introduced.**
2. **Tamanho — measured from the assembled package**, once the `.epub` is written to
   `FileStoragePort`, using the byte length of what was actually stored (not a separate `stat()` call at
   read time).
3. **Single snapshot moment:** all three values become available together, at the point assembly
   completes and the build transitions `gerando → validando` (the same moment the artifact and its size
   exist). They are persisted on the `publicacao` row then, mirroring `artefato_ref`'s lifecycle exactly:
   **non-null iff `status = publicado`** (an `com_erros` attempt has no usable artifact — ADR-003 — so it
   has no size/counts either; `EpubSummaryVM` is documented as "KPI grid for a **valid** export" only,
   SPEC-03 §1). This preserves the append-only invariant: a T08 history row always shows the counts *of
   that build*, even if the manuscript is edited or re-imported afterward.
4. **Páginas is dropped from the BE contract permanently**, not deferred. ePub reflowable rendering has
   no fixed page count; any number PUB could produce (word-count heuristic, byte-size proxy) would be a
   fabricated metric presented as a fact. The FE's `paginas: number | null` field in `EpubSummaryVM`
   stays `null` forever (tile permanently hidden) — this is a **product decision**, not a missing-data
   state, and is not tracked as a future gap.

New columns on `publicacao` (data-model.md §2.1): `tamanho_bytes BIGINT`, `total_capitulos INTEGER`,
`total_imagens INTEGER` — all three governed by the same `CHECK` as `artefato_ref`
(`(status = 'publicado') = (col IS NOT NULL)`). New response fields on `PublicacaoStatus` (§6.1) and
`PublicacaoHistoryItem` (§6.2): `tamanhoBytes`, `totalCapitulos`, `totalImagens` (all nullable, same
non-null-iff-`publicado` rule). No `paginas`/`pages` field is added anywhere in the contract.

## Consequências
Positive: zero new cross-context calls (reuses the IMP walk PUB already performs at assembly time); no
new port to version or fail-over; the append-only semantics of `publicacao` are respected — historical
rows keep the counts *as of that build*, immune to later manuscript edits; "páginas" stops being an open
gap that keeps getting re-raised, because it is closed as **won't-do**, not deferred; three of the four
tiles go from "always omitted" to "always populated for a valid export" (no partial/null state to design
FE fallback for, once §6 changes land).

Negative / trade-offs: `total_capitulos`/`total_imagens` on `publicacao` can drift from
`imp-service.manuscrito.total_capitulos`/`total_imagens` by design (they are a historical snapshot, not
a live mirror) — this must be documented clearly so it is never mistaken for a bug; if `EpubBuilder`'s
counting logic and IMP's own counting logic (`data-model.md` invariant, imp contracts) ever diverge in
definition (e.g. what counts as a "chapter"), the two numbers could visibly disagree — acceptable because
they answer different questions ("what did *this* export contain" vs "what does the manuscript contain
*now*"), but worth a one-line FE tooltip if it causes support confusion later. A future "páginas" request
would need a **new ADR**, not a reopening of this one — the omission here is a decision, not a stub.
