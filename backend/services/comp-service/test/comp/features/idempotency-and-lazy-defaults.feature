# BDD acceptance tests for idempotency guarantees across COMP operations.
# Covers api-contract idempotency clauses and D-M (lazy defaults without creation).
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Idempotency and Lazy Defaults

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: GET metadados before any PUT returns materialized false without creating a record
    Given a project with id "11111111-1111-1111-1111-aaaaaaaaaaaa" in the active empresa
    When the editor requests GET metadados for project "11111111-1111-1111-1111-aaaaaaaaaaaa"
    Then the response status should be 200
    And the response body field "materialized" is false
    And the response body field "titulo" is ""

  Scenario: GET layout before any PUT returns materialized false without creating a record
    Given a project with id "22222222-2222-2222-2222-bbbbbbbbbbbb" in the active empresa
    When the editor requests GET layout for project "22222222-2222-2222-2222-bbbbbbbbbbbb"
    Then the response status should be 200
    And the response body field "materialized" is false

  Scenario: PUT metadados twice with same data is idempotent and returns same result
    Given a project with id "33333333-3333-3333-3333-cccccccccccc" in the active empresa
    And the editor has stored metadados for project "33333333-3333-3333-3333-cccccccccccc" with titulo "Idempotent" and autor "Author" and idioma "pt"
    When the editor sends PUT metadados for project "33333333-3333-3333-3333-cccccccccccc" with titulo "Idempotent" and autor "Author" and idioma "pt"
    Then the response status should be 200
    And the response body field "titulo" is "Idempotent"
    And the response body field "materialized" is true

  Scenario: PUT layout twice with same data is idempotent
    Given a project with id "44444444-4444-4444-4444-dddddddddddd" in the active empresa
    And the editor has stored layout for project "44444444-4444-4444-4444-dddddddddddd" with fonteCorpoTamanho "14"
    When the editor sends PUT layout for project "44444444-4444-4444-4444-dddddddddddd" with fonteCorpoTamanho 14
    Then the response status should be 200
    And the response body field "fonteCorpoTamanho" is 14

  Scenario: DELETE capa when no cover exists returns 204 idempotent
    Given a project with id "55555555-5555-5555-5555-eeeeeeeeeeee" in the active empresa
    When the editor deletes the cover for project "55555555-5555-5555-5555-eeeeeeeeeeee"
    Then the response status should be 204
