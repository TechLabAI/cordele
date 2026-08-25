# Covers SPEC-01 (API surface), SPEC-06 (security/tenancy/signed URL), SPEC-10 (exported ports),
# SPEC-11 (KPI read model). Authoritative decisions: D-F (signed URL, no byte proxy),
# D-O (KPIs from the read model), D-G (LGPD erasure via PublicationErasurePort).
Feature: Publication history, download and cross-context read model

Background:
  Given an authenticated editor of empresa "aetos" with scope "pub:read"
  And project "proj-100" in the active empresa

Scenario: History lists publications newest first
  Given project "proj-100" has the following publicacoes:
    | sequencia | status     | epubcheckStatus  |
    | 1         | com_erros  | erros_criticos   |
    | 2         | publicado  | valido           |
  When the editor lists publications for "proj-100"
  Then the response status is 200
  And the first item has sequencia 2 and epubcheckStatus "valido"
  And the second item has sequencia 1 and arquivoUrl null

Scenario: Downloading a valid publication returns a short-TTL signed URL, never bytes
  Given publicacao "pub-2" of "proj-100" is publicado with epubcheckStatus "avisos"
  When the editor requests the download for "pub-2"
  Then the response status is 200
  And the response body contains a signed "arquivoUrl"
  And the response body contains an "expiresAt"
  And the application does not stream the artifact bytes

Scenario: Downloading a failed publication is refused
  Given publicacao "pub-1" of "proj-100" is com_erros with epubcheckStatus "erros_criticos"
  When the editor requests the download for "pub-1"
  Then the response status is 409
  And the problem type is "urn:cordele:pub:artifact-not-available"

Scenario: KPI stats are computed live from the publication rows
  # D-O: no separate analytics store.
  Given project "proj-100" has the following publicacoes:
    | status     | epubcheckStatus  |
    | publicado  | valido           |
    | publicado  | avisos           |
    | com_erros  | erros_criticos   |
  When the editor reads the publication stats for "proj-100"
  Then the response status is 200
  And the stats field "total" is 3
  And the stats field "publicadas" is 2
  And the stats field "comAvisos" is 1
  And the stats field "comErros" is 1
  And the stats field "emAndamento" is 0

Scenario: PROJ reads the history through the in-process port, not the table
  Given PROJ composes the project detail for "proj-100"
  When PROJ calls PublicationHistoryPort.history for "proj-100"
  Then it receives the PublicacaoHistoryItem list with the fixed field set
  And it never queries the publicacao table directly

Scenario: A publicacao of another empresa is never revealed
  Given publicacao "pub-x" belongs to empresa "outra"
  When the editor of empresa "aetos" requests the status of "pub-x"
  Then the response status is 404
  And the problem type is "urn:cordele:pub:publicacao-not-found"

Scenario: LGPD erasure deletes rows and artifacts idempotently
  Given project "proj-100" has publicacoes with stored ePub artifacts
  When PROJ calls PublicationErasurePort.purge for "proj-100"
  Then all publicacao rows for "proj-100" are deleted
  And all ePub artifacts for "proj-100" are deleted from storage
  And calling purge again for "proj-100" completes without error
