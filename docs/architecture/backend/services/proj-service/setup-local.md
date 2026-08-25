# Setup — Local (proj-service, Projetos)

**Stack:** Node 22 · NestJS 11 · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`.
Projects is a NestJS module (`proj`) inside the Cordelê modular monolith — it is not independently deployed
in the POC. Commands below drive the monolith backend and the `proj` module's tests.

## Dependencies

- **PostgreSQL 16** (schema-per-tenant: `cordele_global` + `emp_<slug>`, e.g. `emp_aetos`). PROJ owns
  `projeto_editorial` (cascade root) and `projeto_status_historico` in the tenant schema.
- **No file storage of its own** — PROJ holds no binaries; ePub download is a signed URL minted by PUB
  (`PublicationHistoryPort.signedDownloadUrl`).
- **No broker, no TechLab AI, no service registry** (`messaging.enabled=false`,
  `serviceDiscovery.enabled=false`, `ai.hasAi=false`).
- **IMP / COMP / PUB modules** present in the monolith for the outbound read/erasure ports; thin stubs are
  acceptable pre-existence (empty summaries/history, no-op idempotent purge — `integration-contracts.md` §4).

## HTTP port

`proj-service` (as part of the monolith) serves under the BFF on **port 3000** (`PORT=3000`), base path
`/api/proj`. This is the port the Node scaffold reads.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `3000` | monolith HTTP port |
| `DATABASE_URL` | `postgresql://cordele:cordele@localhost:5432/cordele?schema=cordele_global` | Prisma base connection; tenant schema targeted at runtime via `EmpresaContext` (RULE-07) |
| `PROJ_DOWNLOAD_URL_TTL_SECONDS` | `300` | short TTL for signed ePub download URLs (D-F) |
| `OAUTH2_JWK_SET_URI` | `http://localhost:8080/realms/cordele/protocol/openid-connect/certs` | JWT validation (scopes `proj:read`, `proj:write`, `proj:delete`) |

## Commands (Node stack)

```bash
pnpm install                          # install deps
pnpm prisma migrate dev               # apply migrations (projeto_editorial + projeto_status_historico + tenant provisioning)
pnpm --filter proj-service start:dev  # run the backend locally (watch mode)
pnpm test                             # run tests (proj unit + e2e)
```

> `pnpm --filter proj-service` targets the module's project in the pnpm/Nx workspace; if the monolith is a
> single app, use `pnpm start:dev` at the backend root. The BDD `.feature` files under `tests/cucumber/`
> are wired by `scripts/be-bdd-generator.py` in the scaffold phase.
