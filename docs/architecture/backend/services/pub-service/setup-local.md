# Setup — Local (pub-service, Publicação)

**Stack:** Node 22 · NestJS 11 · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`.
Publication is a NestJS module (`pub`) inside the Cordelê modular monolith — it is not independently
deployed in the POC. Commands below drive the monolith backend and the `pub` module's tests.

## Dependencies

- **PostgreSQL 16** (schema-per-tenant: `cordele_global` + `emp_<slug>`, e.g. `emp_aetos`).
- **File storage:** local disk (POC) at a configured root; no S3 needed locally. Holds the `.epub`
  artifacts.
- **epubcheck** — the W3C ePub validator (Java CLI/JAR). Requires a **JRE (Java 11+)** on the machine and
  the epubcheck JAR available to the `EpubValidationPort` adapter (invoked as a child process). This is the
  only Java dependency; the service code itself is Node/NestJS.
- **No broker, no TechLab AI, no service registry** (`messaging.enabled=false`,
  `serviceDiscovery.enabled=false`, `ai.hasAi=false`).
- **IMP, COMP, PROJ modules** present in the monolith (PUB reads IMP/COMP and calls PROJ `advanceTo` via
  in-process ports; stubs acceptable pre-modules — see `contracts/integration-contracts.md` §2).

## HTTP port

`pub-service` (as part of the monolith) serves under the BFF on **port 3000** (`PORT=3000`), base path
`/api/pub`. This is the port the Node scaffold reads.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `3000` | monolith HTTP port |
| `DATABASE_URL` | `postgresql://cordele:cordele@localhost:5432/cordele?schema=cordele_global` | Prisma base connection; tenant schema targeted at runtime via `EmpresaContext` (RULE-07) |
| `PUB_STORAGE_DRIVER` | `local` | `local` (POC) or `s3` (prod) |
| `PUB_STORAGE_LOCAL_ROOT` | `./.storage` | local-disk adapter root (shared abstraction with IMP/COMP) |
| `PUB_DOWNLOAD_URL_TTL_SECONDS` | `600` | short-TTL signed download URL lifetime |
| `PUB_POLL_RETRY_AFTER_SECONDS` | `2` | `Retry-After` hint returned while a build is non-terminal (D-N) |
| `EPUBCHECK_JAR_PATH` | `./tools/epubcheck/epubcheck.jar` | path to the bundled epubcheck JAR |
| `EPUBCHECK_JAVA_BIN` | `java` | JRE executable used by the child-process adapter |
| `OAUTH2_JWK_SET_URI` | `http://localhost:8080/realms/cordele/protocol/openid-connect/certs` | JWT validation |

## Commands (Node stack)

```bash
pnpm install                         # install deps
pnpm prisma migrate dev              # apply migrations (publicacao + validation_message + tenant provisioning)
pnpm --filter pub-service start:dev  # run the backend locally (watch mode)
pnpm test                            # run tests (pub unit + e2e)
```

> `pnpm --filter pub-service` targets the module's project in the pnpm/Nx workspace; if the monolith is a
> single app, use `pnpm start:dev` at the backend root. The BDD `.feature` files under `tests/cucumber/`
> are wired by `scripts/be-bdd-generator.py` in the scaffold phase. The build job runs in-process — no
> worker/queue infrastructure to start; a build is observed by polling `GET .../status` (D-N).
