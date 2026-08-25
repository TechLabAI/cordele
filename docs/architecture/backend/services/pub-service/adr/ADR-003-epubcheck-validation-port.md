<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-003 — epubcheck behind an EpubValidationPort as the authority for publication validity

## Status
accepted (2026-08-25) · Scope: the Publication (PUB) context of Cordelê

## Contexto
The core promise of Publication is that it never ships an ePub that is not conformant. Conformance is not
something Cordelê should judge on its own — the reference authority is **epubcheck**, the W3C validator.
But epubcheck is a Java tool (CLI/JAR), foreign to a Node/NestJS service (TECH-001), and its invocation
details (child process now, a hosted validation service later) are an infrastructure concern that must not
leak into the domain. There is also a temptation to treat the assembler's own success as "valid" — which
would let subtly broken packages through.

Forces: calling epubcheck directly from application code couples the domain to a process and an output
format; skipping it or trusting the assembler breaks the core promise; the produced `.epub` is a binary
that does not belong in the database.

## Decisão
**epubcheck runs behind an outbound `EpubValidationPort`, and its verdict — not the assembler's success —
is authoritative for the terminal status.**

1. The domain depends on `EpubValidationPort.validate(package) → ValidationReport`; it knows a *verdict and
   a report*, never a Java process. The `EpubValidationAdapter` (epubcheck child process in the POC) is the
   only place that knows the tool.
2. A `Publicacao` reaches **`publicado` only if** the report has no `error`-severity messages; otherwise it
   is **`com_erros`**. (Warnings do not block; the exact severity threshold is confirmed in Specs — doc 06
   gap.)
3. The full `ValidationReport` is **persisted** with the `Publicacao` (row-per-message), so a failure is
   explainable and auditable.
4. The produced `.epub` binary is stored behind **`FileStoragePort`** (local disk POC / S3-compatible
   prod), referenced by `artefatoRef`; the tables hold a reference, not bytes — mirroring the IMP/COMP
   storage-port pattern. `artefatoRef` is set iff `status = publicado`.

## Consequências
Positive: the "nothing ships unvalidated" invariant is structural, not a convention; the domain is
decoupled from the validator's transport and output format, so epubcheck can be upgraded or replaced by a
hosted service behind the same port; the persisted report makes `com_erros` actionable; artifacts stay out
of the database and are tenant-scoped in storage.

Negative / trade-offs: a hard runtime dependency on a correctly-installed, version-pinned epubcheck (risk
R1, assumption A1) — its absence blocks all publication; mapping raw epubcheck codes to editor-friendly
guidance is extra work left to Specs (doc 06 gap); assembler defects can surface as `com_erros` that
editors cannot fix (risk R2), so the report must distinguish content errors from assembler errors. A
future hosted-validator or in-process pure-TS checker would be a new adapter behind this port and would
supersede this ADR rather than edit it.
