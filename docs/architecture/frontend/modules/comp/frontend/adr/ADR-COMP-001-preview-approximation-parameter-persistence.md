# ADR-COMP-001 — Composition persists parameters, not rendered output; the layout preview is a client-side approximation and ePub fidelity is owned by PUB

- **Status:** proposed (2026-08-25)
- **Scope:** module `comp` (Composição) — frontend only
- **Driven by:** the pipeline ownership split — **COMP owns `Metadados` + `ConfiguracaoLayout`**, IMP
  owns the **immutable** `Manuscrito`, and **PUB owns the ePub build + epubcheck**. COMP sits in the
  middle and must let an editor *see* their book before export without becoming a second renderer or
  a content editor.

## Context

COMP's layout screen (T06 `editor-de-layout-preview`) renders the manuscript page by page with the
editor's typography choices applied live — font family, body size, line spacing, H1/H2/H3 sizes,
margins. This creates a natural temptation to treat the browser preview as **the** artefact: to
render to a canvas and persist that render, or to let the editor manipulate pages and images
directly in the preview (the prototype toolbar even hints at "adicionar página / inserir imagem /
remover página").

Two forces make that wrong for Cordelê:

1. **The real renderer is downstream.** The published artefact is an **ePub 3** built and validated
   by PUB (`epubcheck`). A browser's CSS box model is not an ePub reading system; pagination, font
   substitution and image flow will differ. If COMP persisted a "rendered" layout, PUB would either
   have to honour a browser render it cannot reproduce, or silently diverge from it — both break the
   editor's trust.
2. **Author content is immutable.** `Manuscrito` is owned by IMP and fixed after import — the
   platform's core promise is that *nothing the author wrote is altered*. Structural edits in the
   preview (add/remove pages, insert images into the content flow) would mutate that aggregate from
   the wrong module.

So COMP must decide **what it persists** and **what the preview is**.

## Decision

**COMP persists composition as *parameters*, not as rendered output. The layout preview is an
explicit client-side *approximation*; ePub fidelity is owned by PUB/epubcheck.**

1. COMP's durable state is exactly two parameter aggregates: `Metadados` (title, author, ISBN, cover,
   language, category) and `ConfiguracaoLayout` (font family, body size, line spacing, heading sizes,
   margins), each keyed by `projetoId` and saved by **idempotent upsert**. No rendered HTML/canvas,
   no per-page snapshot, is ever persisted.
2. The T06 preview is a **live, ephemeral, client-only** rendering of the **read-only** `Manuscrito`
   with the current `ConfiguracaoLayout` applied via inline styles. It exists to guide the editor's
   parameter choices — it is **not** the source of the export and is labelled/treated as an
   approximation (doc 01 §7, doc 06 R2).
3. The **authoritative render** is PUB: at export, PUB reads COMP's parameters + IMP's `Manuscrito`,
   builds the ePub and runs `epubcheck`. The preview and the export are kept *aligned* by sharing the
   same typographic rules, but the preview never claims byte-fidelity.
4. COMP performs **no structural edits** to the manuscript. The prototype's page/image toolbar is
   **off** in the MVP (`comp.structuralEdits=false`, R3); any future structural capability is owned
   by IMP or a new editing context, not smuggled into `ConfiguracaoLayout`.
5. Persistence is **pessimistic on advance/export** (await the write, then navigate); the live preview
   is local until then, so there is nothing to roll back.

## Alternatives considered

1. **Persist a rendered snapshot (HTML/canvas/PDF) of the preview as the layout.** — **rejected.**
   The browser render is not the ePub render; PUB could not faithfully reproduce it, and the stored
   snapshot would rot the moment the ePub stylesheet or `Manuscrito` changed. It also duplicates,
   on the client, a responsibility that is authoritatively PUB's.
2. **WYSIWYG editing in the preview, including structural page/image operations.** — rejected: it
   mutates the immutable `Manuscrito` from the wrong module, violates the "author content untouched"
   promise, and inflates COMP's contract far beyond `ConfiguracaoLayout`. Deferred as R3.
3. **Server-side preview render (COMP asks the backend to render each page).** — rejected for the MVP:
   it adds a round-trip per style change (breaking the < 50 ms live-repaint budget) and stands up a
   second renderer distinct from PUB's ePub build — the same divergence risk as (1), now on the
   server. If pixel-accurate preview is ever required, the correct move is to reuse **PUB's** renderer
   for a preview endpoint, not to build a third one in COMP.
4. **Optimistic auto-save on every keystroke/slider move.** — rejected for the MVP: it multiplies
   writes, needs conflict/rollback handling, and buys little for a single-editor composition session.
   Pessimistic save on advance/export keeps the write model simple; auto-save can be revisited in a
   Spec with its own rollback strategy.

## Consequences

- **Positive:** COMP stays a thin, honest configurator — a small, idempotent parameter contract;
  the live preview is instant (no round-trip) because it is pure client state; author content is
  provably untouched; there is exactly one renderer of record (PUB), so no two-renderer drift to
  reconcile; the write model is pessimistic and roll-back-free.
- **Negative:** the preview can diverge from the exported ePub (fonts, pagination, image flow) — the
  editor may be surprised at export time (R2). Layout parameters the ePub stylesheet ignores would be
  offered but ineffective.
- **Mitigations:** keep the preview's typographic rules aligned to the ePub stylesheet PUB uses, and
  restrict the T06 controls to parameters the export actually honours (reconcile with PUB in Specs —
  doc 06 gap). Validate perceived fidelity against a real epubcheck export before GA (assumption A1).
  If byte-accurate preview is later required, expose it through **PUB's** renderer, never a new one in COMP.

## References

- RAG evidence (cordele architecture): "Manuscrito immutable; system never alters author content;
  unparsed segments preserved" (IMP owned aggregate); "Prototype-first (D-493); Signals-first (no NgRx)".
- BA data-model (draft v0.1.0): `Metadados` (`refs.projetoId`), `ConfiguracaoLayout` (`refs.projetoId`).
- `../01-architectural-vision.md` (§6 principles, §7 success signals), `../02-architecture-blueprint.md`
  (§1 boundary, §3 flows), `../05-state-and-data-flow.md` (§2 endpoints, §4 writes).
- `../../proj/frontend/adr/ADR-PROJ-001-server-authoritative-project-state.md` (coherent
  no-client-cache / server-authoritative posture across FE modules).
- `docs/architecture/frontend/adr/ADR-006-module-entry-as-library.md`,
  `docs/architecture/frontend/standards/design-system-tokens.md`.
