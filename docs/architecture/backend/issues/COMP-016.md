# COMP-016 -- GetMetadadosUseCase + GetConfiguracaoLayoutUseCase export wiring for PUB (inbound ports)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements and exports the two inbound ports PUB calls at export time (D-I / G2):
`GetMetadadosUseCase.get(projetoId)` and `GetConfiguracaoLayoutUseCase.get(projetoId)`.
These are **not** REST endpoints — they are in-process DI providers registered by token
that PUB injects. `GetConfiguracaoLayout` must return only **non-stale** overrides honoured
by PUB's stylesheet (api-contract §7.3); stale overrides (whose `referenciaNo` no longer
resolves in the current content tree) are excluded before the response is composed (R2/G4,
SPEC-10.C2). Both return `null` if no composition exists; PUB decides how to handle `null`.

## Spec de referencia
- SPEC-10 (integrations — §1.1 GetMetadadosUseCase, §1.2 GetConfiguracaoLayoutUseCase)
- `contracts/integration-contracts.md` §1.1–§1.2
- `contracts/api-contract.md` §6.1–§6.2, §7.3

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/modules/comp/application/get-metadados-export.use-case.ts` — `get(projetoId): Promise<MetadadosRead | null>`: loads `Metadados` from repository; if absent returns null; maps to api-contract §6.1 shape (`titulo, autor, isbn, idioma, categoria, capaUrl, editoraNome, atualizadoEm`); never exposes `metadados` table directly (port only)
- [x] `src/modules/comp/application/get-configuracao-layout-export.use-case.ts` — `get(projetoId): Promise<LayoutRead | null>`: loads `ConfiguracaoLayout` + overrides; for each override calls `ManuscriptContentPort.nodeExists` to detect stale; returns only non-stale honoured set (parameters from §7.3 only); if absent returns null
- [x] `src/modules/comp/comp.module.ts` (amend) — export `GetMetadadosExportUseCase` and `GetConfiguracaoLayoutExportUseCase` under tokens `GET_METADADOS_PORT` and `GET_CONFIGURACAO_LAYOUT_PORT` so `PubModule` can inject them
- [x] `src/modules/comp/application/get-configuracao-layout-export.use-case.spec.ts` — stale override excluded; non-stale included; absent layout → null; only §7.3 parameters in response

## Criterios de aceite

- [x] `GetConfiguracaoLayoutExportUseCase.get` excludes any override whose `referenciaNo` returns `nodeExists=false`
- [x] Response shape matches api-contract §7.3 exactly (no extra parameters)
- [x] Both use cases return `null` (not throw) when no composition exists
- [x] Both DI tokens exported from `CompModule` so `PubModule` can inject without HTTP
- [x] `pnpm test` on the export use case spec exits 0

## Dependencias

- COMP-004 (precede — `MetadadosRepository` port and use case layer exist)
- COMP-007 (precede — `ManuscriptContentPort` interface exists for stale check)
- COMP-010 (precede — real MetadadosRepository adapter for integration testing)

## Estimativa
M

## Prioridade
P6
