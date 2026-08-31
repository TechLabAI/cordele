# BDD acceptance tests for the PreviewContext (read-only assembly) API.
# Covers api-contract §4.7, SPEC-05 (preview composition), D-K (stale overrides).
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Preview Context Assembly

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: GET preview-context returns projetoId manuscrito layout and staleOverrides fields
    Given a project with id "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab" in the active empresa
    When the editor requests GET preview-context for project "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab"
    Then the response status should be 200
    And the response body contains field "projetoId"
    And the response body contains field "manuscrito"
    And the response body contains field "layout"
    And the response body contains field "staleOverrides"

  Scenario: GET preview-context with no stored records returns lazy defaults
    Given a project with id "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc" in the active empresa
    When the editor requests GET preview-context for project "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc"
    Then the response status should be 200
    And the response body field "layout.materialized" is false

  Scenario: GET preview-context with stale override lists it in staleOverrides
    Given a project with id "cccccccc-cccc-cccc-cccc-cccccccccccd" in the active empresa
    And the editor has stored layout for project "cccccccc-cccc-cccc-cccc-cccccccccccd" with override referencing node "nonexistent-node-id"
    When the editor requests GET preview-context for project "cccccccc-cccc-cccc-cccc-cccccccccccd"
    Then the response status should be 200
    And the response body field "staleOverrides" is not empty

  Scenario: GET preview-context when no manuscript configured returns 409
    Given a project with id "dddddddd-dddd-dddd-dddd-ddddddddddde" in the active empresa
    And the manuscript stub returns null for project "dddddddd-dddd-dddd-dddd-ddddddddddde"
    When the editor requests GET preview-context for project "dddddddd-dddd-dddd-dddd-ddddddddddde"
    Then the response status should be 409
    And the response body contains field "type"

  Scenario: GET preview-context without authorization returns 401
    Given no authenticated user
    When the editor requests GET preview-context without token for project "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab"
    Then the response status should be 401
