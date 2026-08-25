# Setup — Local (comp-service, Composição)

**Stack:** Node 22 · NestJS 11 · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`.
Composition is a NestJS module (`comp`) inside the Cordelê modular monolith — it is not independently
deployed in the POC. Commands below drive the monolith backend and the `comp` module's tests.

## Dependencies

- **PostgreSQL 16** (schema-per-tenant: `cordele_global` + `emp_<slug>`, e.g. `emp_aetos`). COMP owns
  `metadados`, `configuracao_layout` and `layout_override` in the tenant schema.
- **File storage** for the cover binary behind `FileStoragePort`: local disk in the POC (a writable
  directory), S3-compatible in prod. COMP stores `capaUrl`, not the bytes (ADR-003).
- **IMP module** present in the monolith for the in-process `ManuscriptContentPort` (read-only content
  tree used by the preview and by override validation). A thin stub is acceptable pre-existence.
- **PROJ / PUB modules** present for the ports COMP exports (`ProjectMetadataPort`, `CompositionErasurePort`
  for PROJ; `GetMetadados`/`GetConfiguracaoLayout` for PUB) — stubs acceptable pre-existence.
- **No broker, no TechLab AI, no service registry** (`messaging.enabled=false`,
  `serviceDiscovery.enabled=false`, `ai.hasAi=false`).

## HTTP port

`comp-service` (as part of the monolith) serves under the BFF on **port 3000** (`PORT=3000`), base path
`/api/comp`. This is the port the Node scaffold reads.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `3000` | monolith HTTP port |
| `DATABASE_URL` | `postgresql://cordele:cordele@localhost:5432/cordele?schema=cordele_global` | Prisma base connection; tenant schema targeted at runtime via `EmpresaContext` (RULE-07) |
| `COMP_STORAGE_DRIVER` | `disk` | `disk` (POC) or `s3` (prod) — selects the `FileStoragePort` adapter |
| `COMP_STORAGE_DIR` | `./var/covers` | writable directory for the disk adapter (cover binaries) |
| `COMP_COVER_MAX_BYTES` | `10485760` | cover size cap (10 MB, D-L) |
| `OAUTH2_JWK_SET_URI` | `http://localhost:8080/realms/cordele/protocol/openid-connect/certs` | JWT validation (scopes `comp:read`, `comp:write`) |

## Commands (Node stack)

```bash
pnpm install                          # install deps
pnpm prisma migrate dev               # apply migrations (metadados + configuracao_layout + layout_override + tenant provisioning)
pnpm --filter comp-service start:dev  # run the backend locally (watch mode)
pnpm test                             # run tests (comp unit + e2e)
```

> `pnpm --filter comp-service` targets the module's project in the pnpm/Nx workspace; if the monolith is a
> single app, use `pnpm start:dev` at the backend root. The BDD `.feature` files under `tests/cucumber/`
> are wired by `scripts/be-bdd-generator.py` in the scaffold phase.
