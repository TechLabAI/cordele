# Covers SPEC-05. Two aggregates, lazy defaults (D-M): GET default before save, materialize on first PUT, idempotent upsert.
Feature: Lazy defaults and idempotent composition upserts

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

Scenario: Reading layout before any save returns a default with materialized false
  When the editor reads layout for project "proj-1"
  Then the response status is 200
  And the layout field "materialized" is false
  And no configuracao_layout row exists for project "proj-1"

Scenario: The layout row is materialized only on the first PUT
  When the editor saves a valid layout for project "proj-1"
  Then a configuracao_layout row exists for project "proj-1"
  And the layout field "materialized" is true

Scenario: Metadata and layout are two independent aggregates
  When the editor saves metadata for project "proj-1"
  Then a metadados row exists for project "proj-1"
  And no configuracao_layout row exists for project "proj-1"

Scenario: A layout PUT replaces the full override set atomically
  Given a saved layout with overrides on "img-017" and "img-018"
  And the manuscript has image node "img-019"
  When the editor saves a layout with only an override on "img-019"
  Then the persisted overrides are exactly "img-019"

Scenario: Re-sending an identical layout is an idempotent no-op
  Given a saved layout for project "proj-1"
  When the editor saves the same layout again
  Then the response status is 200
  And the layout is unchanged
