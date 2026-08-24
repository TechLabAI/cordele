# Issues Map -- issues

| Issue | Title | Kind | Priority | Status |
|---|---|---|---|---|
| IMP-001 | NestJS ImpModule skeleton + ImpController with all 7 routes wired (4 original + 3 addendum) | BE | P1 | INTACT |
| IMP-002 | Request/Response DTOs: UploadManuscritoDto, ManuscritoDetailDto, ContentTreeDto, ManuscritoSummaryDto, SegmentoCuradoriaDto, ConfirmEstruturaResultDto + validation pipes | BE | P1 | INTACT |
| IMP-003 | Domain aggregate Manuscrito + ContentTree / Block value objects (TypeScript discriminated unions: paragraph, image, unparsed) | BE | P1 | INTACT |
| IMP-004 | ImportManuscriptUseCase: validate -> project binding -> store binary -> parse -> persist Manuscrito -> emit ManuscriptImported | BE | P2 | INTACT |
| IMP-005 | Project binding D-C: projetoTitulo flow via CreateProjetoEditorialUseCase + projetoId validation via ProjetoEditorialLookup | BE | P2 | INTACT |
| IMP-006 | ManuscriptImported + ManuscriptImportRejected in-process event emission via NestJS EventEmitter2 after DB commit | BE | P2 | INTACT |
| IMP-007 | IgnoreSegmentUseCase: persist SegmentoCuradoria row, validate segmentoId against estrutura JSONB, idempotency (UNIQUE constraint) | BE | P2 | INTACT |
| IMP-008 | ConfirmEstruturaUseCase: resolve manuscritoId -> projetoId, call PROJ.AdvanceProjetoStatusUseCase.advanceTo(em_composicao), return ConfirmEstruturaResultDto | BE | P2 | INTACT |
| IMP-009 | Prisma schema Manuscrito model + migration V0001__create_manuscrito (schema-per-tenant, all constraints from data-model.md §2.1) | BE | P3 | INTACT |
| IMP-010 | ManuscritoRepository port + Prisma adapter: findById, listByProjeto, save — with tenant-scoped schema targeting via EmpresaContext | BE | P3 | INTACT |
| IMP-011 | SegmentoCuradoria Prisma model + migration V0002__create_segmento_curadoria + SegmentoCuradoriaRepository (findByManuscrito, save, remove) | BE | P3 | INTACT |
| IMP-012 | ManuscriptParserPort interface + adapter factory dispatching by formato (docx -> mammoth adapter, markdown -> remark adapter) | BE | P4 | INTACT |
| IMP-013 | DOCX parser adapter: mammoth + deterministic style map -> ContentTree with chapter/section/block hierarchy and image extraction | BE | P4 | INTACT |
| IMP-014 | Markdown parser adapter: remark AST -> ContentTree (chapter/section/block) with image reference normalization | BE | P4 | INTACT |
| IMP-015 | UnparsedSegment detection: all 7 reason types (complex_table, math_equation, nested_footnote, unknown_docx_style, unsupported_markup, embedded_object, other) + sourceLocation | BE | P4 | INTACT |
| IMP-016 | FileStoragePort interface + local-disk adapter: put/get/delete with tenant-scoped key scheme emp_<slug>/manuscritos/<id>/ | BE | P4 | INTACT |
| IMP-017 | OAuth2 JWT guard (OAUTH2_JWK_SET_URI) + scope enforcement (imp:write / imp:read) + EmpresaContext AsyncLocalStorage middleware RULE-07 | BE | P5 | INTACT |
| IMP-018 | X-Correlation-Id interceptor + structured JSON logger (empresa, correlationId, manuscritoId) + parse diagnostics emission on upload | BE | P7 | INTACT |
| IMP-019 | Health/readiness endpoint via @nestjs/terminus: DB connectivity + file storage liveness indicators | BE | P7 | INTACT |
| IMP-020 | BDD Cucumber JS step definitions for all three feature files: manuscript-upload-sync-parse, lossless-parse-unparsed-segments, manuscript-immutability-and-tenancy | BE | P8 | INTACT |
| IMP-021 | Test seed fixtures: create livro-3-capitulos.docx, livro-com-tabela-complexa.docx, livro.md, livro.pdf, livro-51mb.docx, livro-corrompido.docx in tests/fixtures/ (SPEC-08 + M5 scaffold seed data) | BE | P8 | INTACT |
| IMP-INT-001 | PROJ inbound port stubs: CreateProjetoEditorialUseCase + ProjetoEditorialLookup — thin NestJS providers allowing IMP to compile before PROJ is scaffolded | INT | P2 | INTACT |
| IMP-INT-002 | PROJ AdvanceProjetoStatusUseCase port stub (confirm-estrutura addendum): interface + thin stub returning em_composicao; real impl lands with PROJ | INT | P2 | INTACT |
| IMP-INT-003 | ManuscriptImported in-process event wiring: NestJS EventEmitter2 bus config + PROJ subscriber stub that calls AdvanceProjetoStatusUseCase on manuscript.imported | INT | P2 | INTACT |
| IMP-INT-004 | Schema-per-tenant Prisma client factory: resolve EmpresaContext slug -> set Prisma schema dynamically for every IMP repository call | INT | P3 | INTACT |
| IMP-INT-005 | FileStoragePort S3-compatible adapter: production-path implementation behind the same port as local-disk adapter | INT | P9 | INTACT |
