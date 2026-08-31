# COMP-006 -- ConfiguracaoLayout domain aggregate + LayoutOverride entity + value objects (bounds)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Defines the pure domain layer for the `ConfiguracaoLayout` aggregate and its child `LayoutOverride`
entity. All typography bounds and heading-order constraints from SPEC-03 and `data-model.md` §2.2–§2.3
are enforced as domain value objects (defense-in-depth — DB CHECKs are the backstop). The aggregate
is instantiated lazily (D-M). The `OverrideTipo` enum allows `imagem` and `em-branco`; the
**application layer** (COMP-007) rejects `em-branco` at write time with 422 (D-H) — the domain
VO must allow both types so the enum stays forward-compatible, but the use case imposes the
POC restriction. `Alinhamento` VO restricts to `{full, centralizado, junto-esquerda, junto-direita}`.

## Spec de referencia
- SPEC-03 (layout overrides — bounds, override model, em-branco deferred)
- `contracts/data-model.md` §2.2–§2.3 (configuracao_layout + layout_override invariants)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/domain/comp/configuracao-layout.aggregate.ts` — `ConfiguracaoLayout` class with `projetoId`, typography fields (fonte_corpo_familia, fonte_corpo_tamanho, espacamento_linha, margem_lateral, h1_tamanho, h2_tamanho, h3_tamanho), `overrides: LayoutOverride[]`, `materialized: boolean`; static `createDefault(projetoId)`; method `update(fields, overrides[])` validates bounds and heading order then returns new instance
- [ ] `src/domain/comp/layout-override.entity.ts` — `LayoutOverride` entity: `referenciaNo`, `tipo: OverrideTipo`, `alinhamento?: Alinhamento`, `ordem: number`; invariant: `tipo=imagem` requires `alinhamento`
- [ ] `src/domain/comp/value-objects/tipografia.vo.ts` — bounds VOs: `FonteCorpo` (12..20), `EspacamentoLinha` (1.2..2.0), `MargemLateral` (10..40), `HeadingSize` (14..48); `HeadingOrder` validator (h1≥h2≥h3)
- [ ] `src/domain/comp/configuracao-layout.aggregate.spec.ts` — unit tests: fonte_corpo_tamanho=11 rejected; h1<h2 rejected; override tipo=imagem without alinhamento rejected; createDefault returns `materialized=false`

## Criterios de aceite

- [x] `fonte_corpo_tamanho=11` throws `DomainException` (below minimum 12)
- [x] `h1_tamanho=20, h2_tamanho=22` throws `DomainException` (h1<h2 violates heading order)
- [x] `LayoutOverride { tipo: 'imagem', alinhamento: undefined }` throws `DomainException`
- [x] `pnpm test` on the aggregate spec exits 0

## Dependencias

Nenhuma (pura domain — sem deps de infraestrutura).

## Estimativa
S

## Prioridade
P2
