# Covers SPEC-04 (data model constraints): invalid status rejection and status-history row on transition.
Feature: Project lifecycle model invariants

Background:
  Given an authenticated editor of empresa "aetos"

Scenario: Persisting a project with an invalid status value is rejected
  # SPEC-04 clause 1 — domain model must reject status values outside the allowed enum
  When an internal actor attempts to set project status to "arquivado"
  Then a validation error is raised
  And the project status remains unchanged

Scenario: A status transition records the change in the status history table
  # SPEC-04 clause 3 — every status change inserts one projeto_status_historico row and updates atualizado_em
  Given an existing project "proj-1" in status "rascunho"
  When the imp context advances project "proj-1" to "em_composicao"
  Then a projeto_status_historico row exists with statusDe "rascunho" and statusPara "em_composicao"
  And the projeto_editorial.atualizado_em is updated to approximately now
