# SPEC-08 — BDD Test Scenarios

**Module:** PROJ · **Refs:** `tests/cucumber/*.feature`, SPEC-02..06.
EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Documentar a prosa, os steps reutilizáveis e os dados de exemplo que suportam os `.feature` (Gherkin puro)
gerados por `scripts/be-bdd-generator.py`. Os `.feature` vivem em `tests/cucumber/`; este SPEC não repete
Gherkin — descreve o que cada feature cobre e os steps partilhados.

## Features

| Arquivo | Cobre | SPECs |
|---|---|---|
| `project-status-authority-transitions.feature` | tabela de transições legais, idempotência, transição ilegal, reopen | SPEC-02, SPEC-05 |
| `project-library-and-history-read.feature` | cards T02 (counts/badge/autor), histórico T08, URL assinada, degradação, tenancy | SPEC-03, SPEC-06 |
| `cross-context-deletion-lgpd-erasure.feature` | cascata leaf-first, idempotência, binários purgados, aborto em falha | SPEC-11, SPEC-05 |
| `project-creation-and-tenancy.feature` | criação em rascunho, isolamento de tenant, ProjectCreated | SPEC-01, SPEC-06 |

## Steps reutilizáveis (definidos uma vez, partilhados)

- `Given an authenticated editor of empresa "<slug>"` — estabelece JWT + `EmpresaContext`.
- `Given an existing project "<id>" in status "<status>"` — semeia `projeto_editorial`.
- `Given project "<id>" has <n> publications with epubcheck "<status>"` — semeia o read-model via stub do
  `PublicationHistoryPort`.
- `When the <context> advances project "<id>" to "<status>"` — chama `advanceTo` (context ∈ imp|pub).
- `Then the project status is "<status>"` / `Then the response status is <code>`.
- `Then a ProjectStatusChanged event is emitted` / `Then no status event is emitted`.

## Dados de exemplo

- Projeto `proj-001` "Romance das Cidades", editora `aetos`; publicações: `avisos` (2 avisos, `arquivoUrl`
  presente) e `erros_criticos` (3 erros, `arquivoUrl=null`) — espelham `mock-data.json#/publicacoes`.
- Transições: `rascunho→em_composicao` (imp), `em_composicao→publicado` (pub), `publicado→com_erros` (pub),
  `com_erros→em_composicao` (reopen), `rascunho→publicado` (ilegal).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL keep every .feature in tests/cucumber as pure Gherkin (.feature, never .md).`
- `THE SYSTEM SHALL cover, across the features, each legal transition, one illegal transition, the
  idempotent no-op, the signed-download rule, and the leaf-first erasure cascade.`
