<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-003 — Cover image stored behind a FileStoragePort, referenced by capaUrl

## Status
accepted (2026-08-25) · Scope: the Composition (COMP) context of Cordelê

## Contexto
Editorial metadata includes a cover image (`capaUrl`). A cover is a binary asset — potentially several
megabytes — unlike the rest of `Metadados`, which is small structured text. Storing image bytes in the
relational row would bloat the tenant schema, complicate backups and migrations, and mix a large blob
into a table read on every metadata screen. Import already established a `FileStoragePort` for manuscript
binaries (local disk in POC, S3-compatible in prod), so the platform already has the pattern.

## Decisão
**The cover binary is stored through a `FileStoragePort` and referenced from `Metadados` by `capaUrl`;
COMP tables never hold the image bytes.** The upload use case streams the file to the port, receives a
storage reference, stores it as `capaUrl`, and persists `Metadados`. Replacing a cover writes a new object
and repoints `capaUrl`. The port has a disk adapter for the POC and an S3-compatible adapter for
production, selected by configuration — the domain depends only on the port. This mirrors IMP's storage
approach so the platform has one storage abstraction, not two.

## Consequências
Positive: metadata rows stay small and fast; storage backend (disk ↔ S3) changes without touching the
domain; one consistent storage pattern across IMP and COMP; the cover naturally participates in tenant
scoping and the project-deletion cascade.

Negative / trade-offs: replaced covers leave orphaned objects that a cleanup routine or storage lifecycle
policy must reap (risk R5, gap G6); deleting a project must delete cover objects across the storage
boundary as part of the cross-context erasure cascade (gap G3); cover format/size validation must be
defined (gap G6). Accepted as standard object-storage housekeeping.
