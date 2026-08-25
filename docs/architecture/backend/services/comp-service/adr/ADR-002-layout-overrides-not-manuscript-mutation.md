<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-002 — Layout adjustments are composition overrides, never manuscript mutations

## Status
accepted (2026-08-25) · Scope: the Composition (COMP) context of Cordelê and its boundary with Import (IMP)

## Contexto
The layout editor (T06) lets the editor change how the book reads: typography, margins, heading sizes,
and page-level adjustments — inserting blank pages and choosing how each image sits on the page (`full`,
`centralizado`, `junto-esquerda`, `junto-direita`). Some of those adjustments are naturally expressed as
"changes to a page", which invites writing them back into the manuscript's content tree.

But Import makes an explicit promise: the imported `Manuscrito` is **immutable** and the system never
alters author content (IMP ADR-002 · core promise). If Composition edited the content tree to record
layout, that promise would break at the exact point the book is assembled, and two contexts would claim
ownership of the same content.

Forces: the preview must faithfully reflect both the author's content and the editor's layout; export
(PUB) must reproduce the same result; the content tree can change if a manuscript is re-imported, so any
layout data attached to it must be able to survive or be reconciled.

## Decisão
**Composition never mutates the manuscript.** It reads the content tree through a read-only
`ManuscriptContentPort` and stores every layout choice — typography *and* page/image adjustments — in its
own aggregates. Page-level adjustments are persisted as **layout overrides** that *reference* manuscript
nodes (`referenciaNo`) plus a placement (`tipo`, `alinhamento`, `ordem`); they describe how content is
presented, not what the content is. The manuscript content tree is owned solely by IMP and is read, never
written, by COMP. The preview and PUB's export both apply the same overrides over the same read-only
content, so what the editor sees is what the book contains.

## Consequências
Positive: Import's immutability promise holds end-to-end, from upload to ePub; content and presentation
have single, separate owners (IMP and COMP); the preview and the build share one configuration source, so
they cannot silently diverge; layout can be revised freely without touching the source.

Negative / trade-offs: overrides can reference nodes that a re-import changes or removes, so COMP must
validate references against the current tree and needs a reconciliation policy on re-import (risk R2, gap
G4); rendering must always compose two sources (content + overrides) rather than reading one "final"
document. Both are accepted as the cost of keeping author content inviolable.
