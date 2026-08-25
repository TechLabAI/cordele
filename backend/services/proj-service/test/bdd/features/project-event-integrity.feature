# Covers SPEC-05 clause 6 (unique eventId), SPEC-09 clauses 2 and 3 (no status change on incoming events; no event on rollback).
Feature: Domain event integrity

Background:
  Given an authenticated principal of empresa "aetos"

Scenario: Every published event carries a unique eventId
  # SPEC-05 clause 6 — eventId uniqueness is mandatory for future at-least-once deduplication
  Given three projects "proj-a", "proj-b", "proj-c" each transitioning to "em_composicao"
  When the three transitions are applied
  Then each emitted ProjectStatusChanged event has a distinct eventId

Scenario: PROJ does not change project status in response to any incoming event
  # SPEC-09 clause 2 — status transitions are exclusively port-driven, never event-driven
  When an external event with name "ManuscriptImported" is dispatched to the PROJ module
  Then no project status changes
  And no ProjectStatusChanged event is emitted

Scenario: No domain event is dispatched when a status transition rolls back
  # SPEC-09 clause 3 — event dispatch happens after commit; a rollback suppresses the event
  Given an existing project "proj-1" in status "rascunho"
  And the persistence layer is configured to roll back on the next write
  When the imp context attempts to advance project "proj-1" to "em_composicao"
  Then the transaction is rolled back
  And no ProjectStatusChanged event is emitted
