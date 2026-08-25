# INT-PUB-002 -- CompositionReadPort adapter: wiring in-process com COMP (metadados + layout)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

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
