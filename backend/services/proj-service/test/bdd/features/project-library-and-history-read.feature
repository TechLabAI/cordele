# Covers SPEC-03 (read composition) and SPEC-06 (tenancy, signed download). Serves T02 and T08.
Feature: Project library and publication history read views

Background:
  Given an authenticated editor of empresa "aetos"

Scenario: The library lists projects with composed cards
  Given an existing project "proj-1" in status "publicado"
  And project "proj-1" has a latest manuscript with 18 chapters and 3 images
  And project "proj-1" has a latest publication with epubcheck "avisos"
  And project "proj-1" has composed metadata with author "Eliana Moraes"
  When the editor lists projects
  Then the response status is 200
  And a card for "proj-1" shows totalCapitulos 18 and totalImagens 3
  And the card for "proj-1" shows ultimoEpubcheckStatus "avisos" and autor "Eliana Moraes"

Scenario: A draft project with no manuscript shows zero counts and a draft badge
  Given an existing project "proj-2" in status "rascunho"
  And project "proj-2" has no manuscript
  When the editor lists projects
  Then a card for "proj-2" shows totalCapitulos 0 and totalImagens 0
  And the card for "proj-2" shows status "rascunho"

Scenario: The library degrades when a cross-context port is unavailable
  Given an existing project "proj-1" in status "publicado"
  And the publication read port is unavailable
  When the editor lists projects
  Then the response status is 200
  And the card for "proj-1" shows ultimoEpubcheckStatus null
  And the response is marked degraded

Scenario: Publication history is returned newest first
  Given an existing project "proj-1" in status "com_erros"
  And project "proj-1" has publications:
    | epubcheckStatus | totalErros | totalAvisos | criadoEm             |
    | erros_criticos  | 3          | 0           | 2026-06-14T09:15:00Z |
    | avisos          | 0          | 2           | 2026-06-19T16:30:00Z |
  When the editor reads the publication history of "proj-1"
  Then the response status is 200
  And the publications are ordered by criadoEm descending

Scenario: A valid publication yields a signed download URL, never a byte stream
  Given an existing project "proj-1" with a publication "pub-1" whose epubcheck is "avisos"
  When the editor requests the download URL for publication "pub-1"
  Then the response status is 200
  And a short-TTL signed arquivoUrl is returned
  And the bytes are not proxied through the service

Scenario: A critically-errored publication is not downloadable
  Given an existing project "proj-1" with a publication "pub-0" whose epubcheck is "erros_criticos"
  When the editor requests the download URL for publication "pub-0"
  Then the response status is 409

Scenario: A project of another empresa is not found
  Given a project "proj-x" belonging to empresa "outra"
  When the editor reads project "proj-x"
  Then the response status is 404

Scenario: A read without the required scope is forbidden
  Given the editor's token lacks scope "proj:read"
  When the editor lists projects
  Then the response status is 403

Scenario: The library is ordered by ultimaAtividadeEm descending
  # SPEC-03 clause 1 — ordering guarantee
  Given two projects "proj-early" (ultimaAtividadeEm 2026-08-01) and "proj-late" (ultimaAtividadeEm 2026-08-25)
  When the editor lists projects
  Then "proj-late" appears before "proj-early" in the response

Scenario: Project detail composes all cross-context fields in one response
  # SPEC-03 clause 4 — detail must include status + manuscriptSummary + metadata + publicationHistory
  Given an existing project "proj-1" in status "publicado"
  And project "proj-1" has a manuscript summary with 12 chapters
  And project "proj-1" has composed metadata with author "Ana Lima"
  And project "proj-1" has one publication with epubcheckStatus "valido"
  When the editor reads the detail of project "proj-1"
  Then the response status is 200
  And the response includes fields status, manuscriptSummary, metadata, and publicationHistory
  And manuscriptSummary.totalCapitulos is 12
  And metadata.autor is "Ana Lima"
  And publicationHistory contains one entry with epubcheckStatus "valido"

Scenario: A publication in pending status is not downloadable
  # SPEC-06 clause 4 — erros_criticos and pendente both yield 409
  Given an existing project "proj-1" with a publication "pub-pending" whose epubcheck is "pendente"
  When the editor requests the download URL for publication "pub-pending"
  Then the response status is 409

Scenario: The library batch-fetches cross-context fields without N+1 calls
  # SPEC-10 clause 3 — one batched port call per context regardless of project count
  Given 5 projects belonging to empresa "aetos" in status "publicado"
  When the editor lists projects
  Then the manuscript summary port was called exactly once with all 5 project IDs
  And the publication read port was called exactly once with all 5 project IDs
