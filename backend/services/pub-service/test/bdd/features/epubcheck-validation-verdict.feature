# Covers SPEC-03 (assembly + validation) and SPEC-02 (orchestration / status advance).
# Authoritative decisions: D-Q (build status vs epubcheck verdict; warnings still publish),
# ADR-003 (epubcheck is authoritative), D-P (advanceTo publicado|com_erros).
Feature: epubcheck verdict drives publication outcome

Background:
  Given an authenticated editor of empresa "aetos" with scope "pub:write"
  And project "proj-100" has an imported manuscript and complete required metadata

Scenario: A clean build publishes and is downloadable
  Given the assembled ePub for project "proj-100" passes epubcheck with no messages
  When the build job for project "proj-100" completes
  Then the publicacao status is "publicado"
  And the publicacao epubcheckStatus is "valido"
  And the artifact reference is set
  And PROJ advanceTo was called with targetStatus "publicado"
  And a "PublicationSucceeded" event was published

Scenario: A build with only warnings still publishes and is downloadable
  # D-Q: avisos does not block publication.
  Given the assembled ePub for project "proj-100" passes epubcheck with 2 warnings and 0 errors
  When the build job for project "proj-100" completes
  Then the publicacao status is "publicado"
  And the publicacao epubcheckStatus is "avisos"
  And the publicacao totalAvisos is 2
  And the artifact reference is set
  And PROJ advanceTo was called with targetStatus "publicado"

Scenario: A build with critical errors fails and is recorded, not discarded
  Given the assembled ePub for project "proj-100" fails epubcheck with 3 errors
  When the build job for project "proj-100" completes
  Then the publicacao status is "com_erros"
  And the publicacao epubcheckStatus is "erros_criticos"
  And the publicacao totalErros is 3
  And the artifact reference is null
  And a resumoErro is recorded
  And PROJ advanceTo was called with targetStatus "com_erros"
  And a "PublicationFailed" event was published

Scenario: The validation report is persisted message-by-message
  Given the assembled ePub for project "proj-100" fails epubcheck with 3 errors and 1 warning
  When the build job for project "proj-100" completes
  Then 4 validation_message rows are persisted for the publicacao
  And the publicacao totalErros is 3 and totalAvisos is 1

Scenario: An unrunnable epubcheck never publishes an unvalidated artifact
  Given epubcheck cannot execute due to a missing JRE or JAR path
  When the build job for project "proj-100" completes
  Then the publicacao status is "com_erros"
  And no artifact is served for download
  And a resumoErro naming the validator failure is recorded

Scenario Outline: The epubcheck verdict maps to status and downloadability
  Given the assembled ePub for project "proj-100" yields verdict "<verdict>"
  When the build job for project "proj-100" completes
  Then the publicacao status is "<status>"
  And the publicacao epubcheckStatus is "<epubcheckStatus>"
  And downloadable is <downloadable>

  Examples:
    | verdict         | status     | epubcheckStatus  | downloadable |
    | valido          | publicado  | valido           | true         |
    | avisos          | publicado  | avisos           | true         |
    | erros_criticos  | com_erros  | erros_criticos   | false        |
