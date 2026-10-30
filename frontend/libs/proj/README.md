# @cordele/proj

**PROJ** — Gerenciamento de Projetos e Publicações do Cordelê.

## Overview

`@cordele/proj` é um módulo funcional Angular/Nx que implementa as telas T02 (Biblioteca de Projetos) e T08 (Download e Histórico). Responsável por:
- **T02:** Listagem de projetos com badges de status (rascunho, em composição, publicado)
- **T08:** Histórico de publicações por projeto + download de versões assinadas
- **Cross-modulo:** Handoff para IMP/COMP/PUB com `projetoId` como rota param

## Architecture

### Current state
- **Structure:** Monolítico em `frontend/libs/proj/src/` (refactor para sublibsmodule planejado para P3)
- **State:** Signals-based (ADR-007, sem NgRx)
- **HTTP:** `@cordele/shared/access-http-base` (interceptor `X-Empresa-Id` para multi-empresa)
- **UI:** TailwindCSS + design tokens

### Key components
- **LibraryFacade:** gerencia estado da biblioteca (lista de projetos, loading/error)
- **HistoryFacade:** gerencia histórico de publicações por projeto
- **BibliotecaDeProjetosComponent (T02):** tela de listagem
- **DownloadEHistoricoComponent (T08):** tela de histórico

### Ports & Adapters
- **PROJETO_PORT:** contrato para operações de Projeto (list, get, reopen, delete)
- **PUBLICACAO_PORT:** contrato para Publicação (list, download)
- **Adapters:** HTTP (real) e Mock (dev) implementados

## Routes

Registradas em `app.routes.ts`:
- `/proj` → rota principal (lazy load via `PROJ_ROUTES`)
- `/proj/biblioteca-de-projetos` → T02 (ListComponent)
- `/proj/projetos/:projetoId/historico` → T08 (HistoryComponent parametrizado)

## Setup (development)

```bash
# Install dependencies
pnpm install

# Setup providers in app.config.ts
import { provideProj } from '@cordele/proj';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideProj({ adapter: 'mock' }),  // or 'http' when backend ready
  ],
};
```

### Configuration
- `adapter: 'mock'` — dev com mock data (sem HTTP)
- `adapter: 'http'` — prod com proj-service real (requer X-Empresa-Id header)

## Development

```bash
# Lint
npx nx lint proj

# Test
npx nx test proj

# Build
npx nx build proj

# Watch (during active feature work)
npx nx build proj --watch
```

## Status & Roadmap

**Current maturity:** 54/100 (Parcial)

| Priority | Scope | Status |
|---|---|---|
| **P1** | Routes, Facades, Components, Models, Adapters | ✅ DONE |
| **P2** | Unit tests (facades/components), E2E tests, Error handling | ⚠️ PARTIAL |
| **P3** | Sublibsmodule refactor, Shell integration, Observability, A11y | ❌ MISSING |

## Quality Gates

| Gate | Status | Details |
|---|---|---|
| **lint** | ✅ PASS | No warnings |
| **test** | ⚠️ PARTIAL | 4 spec tests (routes); components not covered |
| **build** | ✅ PASS | Angular package builds |
| **e2e** | ❌ MISSING | `apps/proj-e2e` not yet created |
| **arch-conformance** | ✅ 6/6 | Boundaries, OnPush, standalone all OK |

## Known limitations (MVP)

- **LGPD delete:** `deleteProjeto()` API exists but UI deferred (M2)
- **Reopen flow:** `reopen()` UI not fully tested
- **Observability:** No pipeline-event hookup yet (D-423)
- **Accessibility:** No WCAG validation; missing aria-labels
- **Structure:** Monolítico; refactor to sublibsmodule planned for P3

## Next steps

1. **Unit tests:** Add test coverage for LibraryFacade, HistoryFacade, components
2. **E2E:** Create `apps/proj-e2e/` with Playwright scenarios
3. **Refactor:** Split into `libs/proj/{shell-entry, data-access, feature-*, ui, integration, navigation}`
4. **Guards:** Wire `proj.view`, `empresaGuard` in routes (FE-PROJ-013)
5. **Integration:** Register `ProjShellIntegrationService` in shell (breadcrumbs)

## Related documents

- `/docs/architecture/frontend/modules/proj/frontend/frontend-spec/` — specifications (SPEC-01..06)
- `/docs/architecture/frontend/modules/proj/frontend/frontend-spec/generator-config.yml` — scaffold config
- `/docs/architecture/frontend/modules/proj/frontend/module-state.md` — module state (FE validator output)
- `/backend/services/proj-service/` — backend service (API contracts, Prisma schema)

## Track

- **Created by:** FE Validator-Orchestrator (D-422/D-494)
- **Status tracker:** `docs/architecture/frontend/plans/plan-FE-PROJ.md` (to be created)
- **Last validated:** 2026-08-31 18:28 UTC (BASELINE)
