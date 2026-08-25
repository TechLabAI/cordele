# PROJ-009 -- Outbound read port stub adapters: ManuscriptSummaryPort + ProjectMetadataPort + PublicationHistoryPort (batched, degraded:true)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

PROJ composes `ProjetoCard` (T02) and `ProjetoDetail` (T08) from its own aggregate plus three
outbound read ports from sibling contexts (IMP, COMP, PUB). Because those contexts may not be
scaffolded yet when PROJ is developed, **thin stubs** are needed first. Each stub returns an
empty `Map` and sets `degraded=true` — the use cases (PROJ-010..012) are already coded to handle
this gracefully (SPEC-07). The real adapters that bind to the sibling in-process query ports are
delivered in PROJ-INT-001..003.

All port signatures are **batched by projetoId set** to avoid N+1 reads (api-contract §6.4,
SPEC-03). This invariant is declared in the port interfaces and enforced at the stub level.

## Spec de referencia
- SPEC-03 (library-and-detail-read-composition, batching constraint)
- SPEC-07 (observability, degraded:true)
- integration-contracts.md §2.1, §2.2, §2.3

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/domain/proj/ports/outbound/manuscript-summary.port.ts` — interface: `summaries(projetoIds: string[]): Promise<Map<string, ManuscriptSummary>>`; `ManuscriptSummary` shape from integration-contracts §2.1
- [ ] `src/domain/proj/ports/outbound/project-metadata.port.ts` — interface: `metadata(projetoIds: string[]): Promise<Map<string, { autor?: string }>>`
- [ ] `src/domain/proj/ports/outbound/publication-history.port.ts` — interface: `history(projetoId: string): Promise<PublicacaoHistoryItem[]>`, `latest(projetoIds: string[]): Promise<Map<string, PublicacaoHistoryItem>>`, `signedDownloadUrl(publicacaoId: string): Promise<{ arquivoUrl: string; expiresAt: string }>`
- [ ] `src/infrastructure/stubs/proj/manuscript-summary.stub.ts` — returns empty `Map`, logs `WARN degraded:true port=ManuscriptSummaryPort`
- [ ] `src/infrastructure/stubs/proj/project-metadata.stub.ts` — returns empty `Map`, logs `WARN degraded:true port=ProjectMetadataPort`
- [ ] `src/infrastructure/stubs/proj/publication-history.stub.ts` — `history()` returns `[]`, `latest()` returns empty `Map`, `signedDownloadUrl()` throws `ArtifactNotAvailableError`; all log `WARN degraded:true port=PublicationHistoryPort`
- [ ] `src/modules/proj/proj.module.ts` — register stubs under `MANUSCRIPT_SUMMARY_PORT`, `PROJECT_METADATA_PORT`, `PUBLICATION_HISTORY_PORT` DI tokens (update PROJ-001 deliverable; swappable via env-flag for real adapter from PROJ-INT-001..003)

## Criterios de aceite

- [ ] Stub adapters implement the port interfaces (TypeScript compiles with `implements` clause)
- [ ] `summaries([])` and `latest([])` return empty `Map` (not error) — degraded path safe for zero projects
- [ ] Each stub logs `WARN degraded:true port=<PortName>` on every call (verifiable in unit test via logger spy)
- [ ] Integration tests can override stubs via `overrideProvider` in NestJS testing module
- [ ] `pnpm build` exits 0 with all 3 stubs registered

## Dependencias

- PROJ-001 (precede — ProjModule DI token declarations)

## Estimativa
M

## Prioridade
P4
