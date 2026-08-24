# Unresolved questions — discovery ingestion (D-073)

> Source: `D:\01_Trabalho\Cybersoft\TechLab IA\techlab-ba\projects\cordele`
> Generated at: 2026-08-24T13:04:45Z

The discovery ingestion populated `project-context.json` with the fields it could extract confidently. The items below need human input before running `/new-project P1`. Edit `project-context.json` directly, then proceed.

## Open items

_(no unresolved items — every required field was extracted)_
## Field provenance

Which input file each extracted field came from:

- `_extensions.compliance` ← `business/constraints.md`
- `_extensions.data_model` ← `design/data-model.json`
- `_extensions.frontend_reference` ← `design/ (angular-prototype + design-system)`
- `_extensions.lbc_personas` ← `business/lean-business-case.md`
- `_extensions.module_candidates` ← `business/technical-framing.md`
- `_extensions.stakeholder_roles` ← `business/stakeholders.md`
- `_extensions.wireframe` ← `design/wireframe.md`
- `growth` ← `handoff-package.md (§7.1 growth:)`
- `modules.registry` ← `handoff-package.md`
- `multiTenancy.globalSchema` ← `handoff-package.md`
- `multiTenancy.isolationStrategy` ← `handoff-package.md (D-293 derived)`
- `multiTenancy.mode` ← `handoff-package.md (D-293 normalized: isolation/term decoupled, mode from LBC classification)`
- `multiTenancy.term` ← `handoff-package.md (D-293 derived)`
- `project.codeName` ← `handoff-package.md`
- `project.description` ← `business/lean-business-case.md`
- `project.displayName` ← `business/lean-business-case.md`
- `project.issuePrefix` ← `handoff-package.md`
- `project.name` ← `business/lean-business-case.md`
- `project.rigorLevel` ← `handoff-package.md`
- `project.segment` ← `handoff-package.md`
- `stack.backend.framework` ← `architecture/adr/ADR-002-bff-nodejs-nestjs.md`
- `stack.backend.packageBase` ← `handoff-package.md`
- `stack.database.engine` ← `handoff-package.md`
- `stack.frontend.framework` ← `architecture/adr/ADR-001-frontend-angular-nx.md`
- `stack.frontend.monorepoTool` ← `architecture/adr/ADR-001-frontend-angular-nx.md`
- `stack.frontend.npmScope` ← `handoff-package.md`

## ADRs preserved

8 ADR file(s) copied verbatim to `_inbox/adr/` as discovery history. The framework's own ADR generation produces a parallel set under `docs/architecture/backend/adr/` in P2.

- `_inbox/adr/ADR-001-frontend-angular-nx.md`
- `_inbox/adr/ADR-002-bff-nodejs-nestjs.md`
- `_inbox/adr/ADR-003-epub3-unico-formato-exportacao.md`
- `_inbox/adr/ADR-004-epubcheck-validador-epub.md`
- `_inbox/adr/ADR-005-poc-single-tenant.md`
- `_inbox/adr/ADR-006-postgresql-banco-de-dados.md`
- `_inbox/adr/ADR-007-filestorage-disco-local-poc.md`
- `_inbox/adr/ADR-008-exportacao-dual-epub3-pdf-puppeteer.md`
