# INT-PUB-002 -- CompositionReadPort adapter: wiring in-process com COMP (metadados + layout)

**Status:** REDUCED -- pos-validacao 2026-09-03
**Maturidade:** 15 -- Inicial
**Done/Total:** 3/7 itens

**Verificação de integração real (2026-09-02):** A nota de bloqueio de 2026-08-29 foi superada. O comp-service está finalizado e em execução. Evidências coletadas em 2026-09-02:

- `GET /api/v1/comp/health` → `{"status":"ok","checks":{"db":"ok","storage":"ok"}}` — serviço saudável na porta 3001.
- `GET /api/v1/comp/projetos/{id}/metadados` → HTTP 401 (endpoint existe, auth guard ativo, path correto).
- `GET /api/v1/comp/projetos/{id}/layout` → HTTP 401 (endpoint existe, auth guard ativo, path correto).
- Análise estática de contrato: `MetadadosViewDto` e `LayoutViewDto` do comp-service batem exatamente com `CompMetadadosResponse` e `CompLayoutResponse` nos adapters PUB (campos, tipos, flag `materialized`, mapeamento de overrides).
- Correção aplicada: default `COMP_SERVICE_URL` nos adapters corrigido de `localhost:3003` (apontava para proj-service) para `localhost:3001` (port externa correta do comp-service no docker-compose).
- `COMP_SERVICE_URL: http://comp-service:3000` adicionado ao `docker/docker-compose.dev.yml` para pub-service.
- Para habilitar integração real em dev: `PUB_USE_STUBS=false` + `COMP_SERVICE_URL=http://localhost:3001` (pub-service local) ou `http://comp-service:3000` (docker-interno).

## Contexto

Substituir o stub `CompositionReadPort` (PUB-012) pelo adapter real que chama in-process os
providers de COMP: `GetMetadadosUseCase.get(projetoId)` e `GetConfiguracaoLayoutUseCase.get(projetoId)`.
O adapter injeta os tokens de COMP por DI (exportados pelo `CompModule`) sem imports diretos de
implementações internas (ADR-001 hexagonal boundary).

## Spec de referencia
- `contracts/integration-contracts.md` (§2.2/§2.3 — GetMetadadosUseCase + GetConfiguracaoLayoutUseCase)
- SPEC-10 (integrations §2.2/§2.3)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/infrastructure/http/comp-composition-metadata.adapter.ts` + `src/infrastructure/http/comp-composition-layout.adapter.ts` — (path real difere: split em dois adapters HTTP em vez de um adapter de integração DI; arquitetura real é microserviços via HTTP, não DI in-process); ambos verificados P12
- [x] `src/infrastructure/pub/pub-infra-bindings.module.ts` — wiring condicional: `PUB_USE_STUBS !== true` → adapters reais `CompCompositionMetadataAdapter` + `CompCompositionLayoutAdapter`; stub via `StubsModule` quando ativo; verificado P12
- [x] `src/infrastructure/http/comp-composition-metadata.adapter.spec.ts` + `src/infrastructure/http/comp-composition-layout.adapter.spec.ts` — specs individuais por adapter; testes passando; verificado P12
- [x] Verificar CompModule exports — N/A: arquitetura real é HTTP, comp-service expõe endpoints REST; URLs verificadas: `GET /api/v1/comp/projetos/{id}/metadados` e `/layout` retornam 401 (auth guard ativo, endpoints existem); verificado P12

## Criterios de aceite
- [x] `pnpm test src/infrastructure/http/comp-composition-metadata.adapter.spec.ts` exits 0 (passes no path real)
- [x] Nenhum import direto de COMP — verificado: adapters usam `fetch` nativo, sem imports de comp-service
- [x] `getConfiguracaoLayout` retornando `null` não quebra `EpubBuilder` — verificado no `publication-build.job.ts`: layout null → EpubBuilder usa defaults

## Dependencias
- PUB-012 (stub a substituir)
- PUB-003 (ICompositionReadPort interface)
- COMP-001 (CompModule e DI tokens)

## Estimativa
S

## Prioridade
P6
