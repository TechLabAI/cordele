# INT-PUB-002 -- CompositionReadPort adapter: wiring in-process com COMP (metadados + layout)

**Status:** IN-PROGRESS -- 2026-09-02 (desbloqueada; COMP concluido com GetMetadadosExportUseCase e GetConfiguracaoLayoutExportUseCase; plano P10 em plan-PUB.md; padrao HTTP adapter em infrastructure/http/ com bearer token via EmpresaContextService.getBearerToken())
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

**Nota de bloqueio (2026-08-29):** COMP-service é atualmente um esqueleto CRUD genérico sem domínio real de Metadados/ConfiguracaoLayout. Para implementar INT-PUB-002, COMP-service precisa:
1. Arquitetar agregados reais `MetadadosEditorial` e `ConfiguracaoLayout` (P1-P2 COMP).
2. Implementar casos de uso `GetMetadadosUseCase` e `GetConfiguracaoLayoutUseCase` (P2 COMP).
3. Exportar tokens `GET_METADADOS_USE_CASE` e `GET_CONFIGURACAO_LAYOUT_USE_CASE` (P6 COMP).

Quando COMP completar seu ciclo P1-P6 (visão, specs, backlog, implementação, ports exportadas), INT-PUB-002 será desbloqueada automaticamente neste repositório. Até lá, a arquitetura usa stubs locais (PUB-012) que retornam `null` para `getMetadados()` e `getConfiguracaoLayout()`, causando e2e skip e score E2E=0/10 provisoriamente.

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
