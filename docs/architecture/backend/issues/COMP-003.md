# COMP-003 -- Metadados domain aggregate + value objects (Titulo, Autor, Idioma, CoverRef)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Define the pure domain layer for the `Metadados` aggregate. The aggregate enforces all
invariants from SPEC-02 and `data-model.md` §2.1 as value objects so that no validation is
duplicated in adapters or controllers. `titulo`/`autor` must be non-blank; `idioma` must be
one of `{pt,en,es,fr}`; `isbn`, `categoria`, `capaUrl` are optional. The aggregate is
instantiated lazily (D-M): `Metadados.createDefault(projetoId)` produces a `materialized=false`
representation for GET before first PUT; `Metadados.upsert(...)` materializes and validates.

## Spec de referencia
- SPEC-02 (metadata configuration — invariants, upsert, cover)
- `contracts/data-model.md` §2.1 (metadados table invariants)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/domain/comp/metadados.aggregate.ts` — `Metadados` class with `projetoId`, `titulo`, `autor`, `isbn?`, `idioma`, `categoria?`, `capaUrl?`, `editoraNome?`, `atualizadoEm`, `materialized: boolean`; static `createDefault(projetoId)` → `materialized=false`; instance method `update(fields)` → validates and returns new instance
- [ ] `src/domain/comp/value-objects/idioma.vo.ts` — `Idioma` enum VO (`pt|en|es|fr`); throws `DomainException` on invalid value
- [ ] `src/domain/comp/value-objects/non-blank-text.vo.ts` — reusable VO for `titulo`/`autor`: non-empty after trim; throws `DomainException`
- [ ] `src/domain/comp/metadados.aggregate.spec.ts` — unit tests: valid upsert; blank titulo rejected; invalid idioma rejected; createDefault returns `materialized=false`

## Criterios de aceite

- [ ] `Metadados.update({ titulo: '', autor: 'X', idioma: 'pt' })` throws `DomainException`
- [ ] `Metadados.update({ titulo: 'T', autor: 'A', idioma: 'zz' })` throws `DomainException`
- [ ] `Metadados.createDefault('id')` returns `{ materialized: false }`
- [ ] `pnpm test` on the aggregate spec exits 0

## Dependencias

Nenhuma (pura domain — sem deps de infraestrutura).

## Estimativa
S

## Prioridade
P2
