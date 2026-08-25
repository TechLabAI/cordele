# Covers SPEC-03 (preview). Preview is DATA for client-side rendering (D-K / FE ADR-COMP-001), never rendered output.
Feature: Read-only preview context

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

Scenario: The preview context returns the read-only content tree plus layout and overrides
  Given the project has an imported manuscript with image node "img-017"
  And a saved layout with an image override on "img-017"
  When the editor opens the preview for project "proj-1"
  Then the response status is 200
  And the preview context contains the read-only manuscript content tree
  And the preview context contains the current layout
  And the preview context contains the honoured overrides

Scenario: The preview returns data, never rendered HTML or a persisted snapshot
  Given the project has an imported manuscript with image node "img-017"
  When the editor opens the preview for project "proj-1"
  Then the preview context is data only
  And no rendered snapshot is persisted

Scenario: An override whose node no longer exists is flagged stale and excluded from the honoured set
  Given a saved layout with an image override on "img-042"
  And the manuscript no longer contains node "img-042"
  When the editor opens the preview for project "proj-1"
  Then the override "img-042" is marked stale
  And the override "img-042" is excluded from the honoured overrides

Scenario: Previewing a project without an imported manuscript is rejected
  Given the project has no imported manuscript
  When the editor opens the preview for project "proj-1"
  Then the response status is 409
  And the problem type is "urn:cordele:comp:manuscript-missing"
