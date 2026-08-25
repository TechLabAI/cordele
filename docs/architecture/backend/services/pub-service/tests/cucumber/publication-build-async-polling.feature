# Covers SPEC-01 (API surface), SPEC-02 (build orchestration), SPEC-05 (idempotency/concurrency).
# Authoritative decisions: D-N (202 + polling, no SSE), D-R (single in-flight, idempotent trigger).
Feature: Asynchronous ePub build with bounded status-polling

Background:
  Given an authenticated editor of empresa "aetos" with scope "pub:write"
  And an existing project "proj-100" in the active empresa
  And project "proj-100" has an imported manuscript
  And project "proj-100" has complete metadata with titulo "Romance das Cidades" autor "Eliana Moraes" idioma "pt"

Scenario: Triggering an export enqueues a build and returns 202 immediately
  When the editor triggers an export for project "proj-100"
  Then the response status is 202
  And the response body field "status" is "gerando"
  And the response body field "epubcheckStatus" is "pendente"
  And the response body contains a publicacaoId
  And the response has a Location header for the publicacao

Scenario: Polling reports the build machine states until terminal
  Given an export was triggered for project "proj-100" yielding publicacao "pub-1"
  When the editor polls the status of "pub-1"
  Then the response status is 200
  And the response body field "status" is one of "gerando, validando, publicado, com_erros"
  And the response includes a "Retry-After" header for a non-terminal build

Scenario: Triggering again while a build is in flight returns the same publicacao (idempotent)
  Given an export is in flight for project "proj-100" as publicacao "pub-1"
  When the editor triggers an export for project "proj-100"
  Then the response status is 200
  And the response body field "publicacaoId" is "pub-1"
  And no second build job is started

Scenario: Exporting without an imported manuscript is rejected before any job
  Given project "proj-200" in the active empresa has no imported manuscript
  When the editor triggers an export for project "proj-200"
  Then the response status is 409
  And the problem type is "urn:cordele:pub:manuscript-missing"
  And no publicacao is persisted

Scenario: Exporting without required metadata is rejected before any job
  Given project "proj-300" in the active empresa has an imported manuscript
  And project "proj-300" has no metadata autor
  When the editor triggers an export for project "proj-300"
  Then the response status is 422
  And the problem type is "urn:cordele:pub:metadata-incomplete"
  And no publicacao is persisted

Scenario: Re-exporting a finished project creates a new attempt with the next sequencia
  # D-P: re-export is a new Publicacao, not a reopen.
  Given project "proj-100" has a terminal publicacao with sequencia 1
  When the editor triggers an export for project "proj-100"
  Then the response status is 202
  And the new publicacao has sequencia 2
