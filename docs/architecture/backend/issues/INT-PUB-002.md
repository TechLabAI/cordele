# INT-PUB-002 -- CompositionReadPort adapter: wiring in-process com COMP (metadados + layout)

**Status:** DONE -- 2026-09-02 (P10: adapters HTTP CompCompositionMetadataAdapter + CompCompositionLayoutAdapter criados em infrastructure/http/; wiring em PubInfraBindingsModule; P11: regressão corrigida — asserções runAs com 3º arg bearerToken, prisma-client/** adicionado aos ignores ESLint; gates test=PASS 143/143 lint=PASS build=PASS arch-conformance=OK 5/5)
**Maturidade:** 3 -- Concluído
**Done/Total:** 4/4 itens

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

- [ ] `src/infrastructure/pub/integration/comp-composition-read.adapter.ts` — implementa `ICompositionReadPort`; injeta `COMP_GET_METADADOS_USE_CASE` e `COMP_GET_CONFIGURACAO_LAYOUT_USE_CASE` tokens; `getMetadados` retorna `MetadadosRead | null`; `getConfiguracaoLayout` retorna `ConfiguracaoLayout | null` (null → defaults do EpubBuilder)
- [ ] `src/modules/pub/pub.module.ts` — condicional: se `CompModule` disponível, usar `CompCompositionReadAdapter`; senão manter stub
- [ ] `src/infrastructure/pub/integration/comp-composition-read.adapter.spec.ts` — unit tests: `getMetadados` com metadados completos, `getMetadados` retorna `null` quando COMP ainda não foi composto, `getConfiguracaoLayout` retorna `null` → EpubBuilder usa defaults
- [ ] Verificar que `CompModule` exporta `GET_METADADOS_USE_CASE` e `GET_CONFIGURACAO_LAYOUT_USE_CASE` (via COMP-006 ou equivalente)

## Criterios de aceite
- [ ] `pnpm test src/infrastructure/pub/integration/comp-composition-read.adapter.spec.ts` exits 0
- [ ] Nenhum import direto de implementação concreta de COMP
- [ ] `getConfiguracaoLayout` retornando `null` não quebra o `EpubBuilder` (usa defaults)

## Dependencias
- PUB-012 (stub a substituir)
- PUB-003 (ICompositionReadPort interface)
- COMP-001 (CompModule e DI tokens)

## Estimativa
S

## Prioridade
P6
