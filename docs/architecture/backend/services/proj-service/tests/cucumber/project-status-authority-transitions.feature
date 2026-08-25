# Covers SPEC-02 (status authority) and SPEC-05 (idempotency). ADR-002.
Feature: Project status authority and legal transitions

Background:
  Given an authenticated editor of empresa "aetos"

Scenario: Import advances a draft project into composition
  Given an existing project "proj-1" in status "rascunho"
  When the imp context advances project "proj-1" to "em_composicao"
  Then the project status is "em_composicao"
  And a ProjectStatusChanged event is emitted with statusDe "rascunho" and statusPara "em_composicao"

Scenario: Publication marks a composed project as published
  Given an existing project "proj-1" in status "em_composicao"
  When the pub context advances project "proj-1" to "publicado"
  Then the project status is "publicado"
  And a ProjectStatusChanged event is emitted

Scenario: A later failed export flips a published project to error
  Given an existing project "proj-1" in status "publicado"
  When the pub context advances project "proj-1" to "com_erros"
  Then the project status is "com_erros"
  And a ProjectStatusChanged event is emitted

Scenario: Advancing to the current status is an idempotent no-op
  Given an existing project "proj-1" in status "publicado"
  When the pub context advances project "proj-1" to "publicado"
  Then the project status is "publicado"
  And no status event is emitted

Scenario: Re-confirming an already-composed project never regresses
  Given an existing project "proj-1" in status "publicado"
  When the imp context advances project "proj-1" to "em_composicao"
  Then the project status is "publicado"
  And no status event is emitted

Scenario: Skipping composition is an illegal transition
  Given an existing project "proj-1" in status "rascunho"
  When the pub context advances project "proj-1" to "publicado"
  Then an IllegalStatusTransition error is raised
  And the project status is "rascunho"

Scenario: The editor reopens a published project for a new revision
  Given an existing project "proj-1" in status "publicado"
  When the editor reopens project "proj-1"
  Then the response status is 200
  And the project status is "em_composicao"
  And a ProjectStatusChanged event is emitted

Scenario: Reopening a draft is rejected
  Given an existing project "proj-1" in status "rascunho"
  When the editor reopens project "proj-1"
  Then the response status is 409

Scenario Outline: The legal-transition table is enforced
  Given an existing project "proj-1" in status "<from>"
  When the <context> advances project "proj-1" to "<to>"
  Then the transition outcome is "<outcome>"

  Examples:
    | from          | context | to            | outcome  |
    | rascunho      | imp     | em_composicao | applied  |
    | em_composicao | pub     | publicado     | applied  |
    | em_composicao | pub     | com_erros     | applied  |
    | com_erros     | pub     | publicado     | applied  |
    | rascunho      | pub     | com_erros     | rejected |
    | em_composicao | imp     | em_composicao | noop     |

Scenario: Reopening a project with export errors also opens it for revision
  # SPEC-02 clause 5 — reopen is valid from com_erros too (the only regression arc)
  Given an existing project "proj-1" in status "com_erros"
  When the editor reopens project "proj-1"
  Then the response status is 200
  And the project status is "em_composicao"
  And a ProjectStatusChanged event is emitted
