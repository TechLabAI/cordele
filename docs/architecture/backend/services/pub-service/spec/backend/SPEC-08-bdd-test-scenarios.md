# SPEC-08 — BDD Test Scenarios

**Module:** PUB · **Refs:** `tests/cucumber/*.feature`, `docs/architecture/backend/standards/ears-notation.md`,
`docs/architecture/backend/standards/node-testing-conventions.md`.

## Objetivo

Mapear os cenários Gherkin executáveis para as SPECs/decisões, e documentar os steps reutilizáveis e dados
de exemplo (prosa vai aqui; Gherkin puro vai nos `.feature`).

## Feature files (Gherkin puro em `tests/cucumber/`)

| Arquivo | Cobre | Decisões |
|---|---|---|
| `publication-build-async-polling.feature` | SPEC-01, SPEC-02, SPEC-05 | D-N, D-R, D-P |
| `epubcheck-validation-verdict.feature` | SPEC-02, SPEC-03 | D-Q, ADR-003 |
| `publication-history-download-and-erasure.feature` | SPEC-01, SPEC-06, SPEC-10, SPEC-11 | D-F, D-O, D-G |

## Steps reutilizáveis (implementados na fase de scaffold — `be-bdd-generator.py`)

- **Auth/tenant:** `an authenticated editor of empresa {string} with scope {string}` — monta JWT com claim
  de empresa e scope; estabelece `EmpresaContext`.
- **Projeto/pré-condições:** `an existing project {string} in the active empresa`,
  `project {string} has an imported manuscript` (stub do `ManuscriptContentPort`),
  `project {string} has complete metadata with titulo {string} autor {string} idioma {string}` (stub do
  `GetMetadadosUseCase`),
  `project {string} has the following publicacoes:` + DataTable — seed de múltiplas publicacoes com status
  e epubcheckStatus explícitos; evita parentheses no step text (Cucumber Expression parse error).
- **Build/veredito:** `the assembled ePub for project {string} passes epubcheck with {int} warnings and {int} errors`,
  `the assembled ePub for project {string} fails epubcheck with {int} errors`,
  `the assembled ePub for project {string} yields verdict {string}`,
  `epubcheck cannot execute due to a missing JRE or JAR path` — configura o fake do `EpubValidationPort`.
- **Assertivas de porta:** `PROJ advanceTo was called with targetStatus {string}`, `a {string} event was
  published` — espiões nas portas out-of-context e no event emitter.
- **Polling não-terminal:** `the response includes a "Retry-After" header for a non-terminal build` —
  verifica presença do header sem "or" literal no step text (evita step definition ambíguo).

## Dados de exemplo

- Projeto `proj-100`: manuscrito importado + metadados completos (`titulo/autor/idioma`).
- Projetos negativos: `proj-200` (sem manuscrito), `proj-300` (metadados incompletos — sem autor).
- Vereditos: `valido` (0 msg), `avisos` (N warnings), `erros_criticos` (N errors) — parametrizados por
  `Scenario Outline` em `epubcheck-validation-verdict.feature`.
- Fixture de stats: 3 publicacoes via DataTable (`publicado/valido`, `publicado/avisos`,
  `com_erros/erros_criticos`) → `total=3`, `publicadas=2`, `comAvisos=1`, `comErros=1`, `emAndamento=0`.
  Cobre o KPI `emAndamento` exigido por SPEC-11 EARS.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL expose every authoritative decision (D-N, D-R, D-P, D-Q, D-F, D-O, D-G) in at least
  one executable scenario.`
- `THE SYSTEM SHALL keep .feature files as pure Gherkin (no .md), one feature per file, kebab-case names.`
- `THE SYSTEM SHALL document reusable steps and example data here, not in the .feature files.`
- `THE SYSTEM SHALL use DataTable fixtures whenever a step would otherwise require parentheses or bare
  enum discriminators inline (Cucumber Expression reserved characters).`
