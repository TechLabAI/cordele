# SPEC-08 — BDD Test Scenarios

**Module:** COMP · **Refs:** all SPECs; `contracts/api-contract.md`; `tests/cucumber/*.feature`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Descrever, em prosa, os cenários BDD que os `.feature` (Gherkin puro) cobrem, os steps reutilizáveis e os
dados de exemplo. O `scripts/be-bdd-generator.py` filtra `*.feature` (arquivos `.md` são ignorados).

## Feature files (Gherkin puro em `tests/cucumber/`)

| Arquivo | SPECs cobertas | Foco |
|---|---|---|
| `metadata-configuration-and-tenancy.feature` | SPEC-02, SPEC-06 | upsert de metadados, obrigatórios, idioma, tenant do claim |
| `cover-upload-constraints.feature` | SPEC-02, SPEC-06 | tipo/tamanho da capa (jpeg/png/webp ≤ 10 MB), opcional |
| `layout-and-image-alignment-overrides.feature` | SPEC-03, SPEC-04 | bounds de tipografia, overrides de alinhamento, `em-branco` deferido, ref inexistente |
| `read-only-preview-context.feature` | SPEC-03 | preview como dados, overrides stale, sem manuscrito → 409 |
| `composition-boundary-and-ports.feature` | SPEC-01, SPEC-09, SPEC-10 | COMP não muda status, GetMetadados/GetLayout para PUB, erasure idempotente |
| `composition-lazy-defaults-idempotency.feature` | SPEC-05 | GET default (materialized=false), upsert idempotente |

## Steps reutilizáveis (não repetir nos `.feature`)

- `Given an authenticated editor of empresa "<slug>"` — popula `EmpresaContext` com scope adequado.
- `Given a project "<id>" in status "em_composicao"` — projeto PROJ existente no tenant ativo.
- `Given the project has an imported manuscript with image node "<referenciaNo>"` — árvore read-only via
  `ManuscriptContentPort` (stub/fixture no teste).
- `When the editor PUTs metadata ...` / `When the editor PUTs layout ...` / `When the editor uploads a cover ...`.
- `Then the response status is <code>` / `Then a <Event> event is emitted` / `Then the project status is unchanged`.

## Dados de exemplo

- Idiomas válidos: `pt|en|es|fr`; inválido: `de` → 400.
- Capa: `capa.jpg` (image/jpeg, 2 MB) OK; `capa.gif` (image/gif) → 415; `capa-grande.png` (12 MB) → 413.
- Layout bounds: `fonteCorpoTamanho=12..20`, `espacamentoLinha=1.2..2.0`, `margemLateral=10..40`,
  headings `14..48`, `h1≥h2≥h3`.
- Override: `{ referenciaNo:"img-017", tipo:"imagem", alinhamento:"centralizado", ordem:1 }` OK;
  `tipo:"em-branco"` → 422; `referenciaNo:"img-999"` (inexistente) → 422.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL express every acceptance criterion in SPEC-01..10 as at least one Gherkin scenario.`
- `THE SYSTEM SHALL keep .feature files in pure Gherkin (no .md) so be-bdd-generator.py picks them up.`
- `THE SYSTEM SHALL assert, in the boundary feature, that no COMP operation changes projeto_editorial.status.`
