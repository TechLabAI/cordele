# BDD acceptance tests for the Metadados (editorial metadata) API.
# Covers api-contract §4.1-§4.2, SPEC-02 (metadata domain) and D-M (lazy defaults).
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Metadata Configuration

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: GET metadados for new project returns lazy default with materialized false
    Given a project with id "11111111-1111-1111-1111-111111111111" in the active empresa
    When the editor requests GET metadados for project "11111111-1111-1111-1111-111111111111"
    Then the response status should be 200
    And the response body field "materialized" is false
    And the response body field "projetoId" is "11111111-1111-1111-1111-111111111111"

  Scenario: PUT metadados stores metadata and returns materialized true
    Given a project with id "22222222-2222-2222-2222-222222222222" in the active empresa
    When the editor sends PUT metadados for project "22222222-2222-2222-2222-222222222222" with titulo "Livro Teste" and autor "Autor Teste" and idioma "pt"
    Then the response status should be 200
    And the response body field "materialized" is true
    And the response body field "titulo" is "Livro Teste"
    And the response body field "autor" is "Autor Teste"

  Scenario: GET metadados after PUT returns persisted data
    Given a project with id "33333333-3333-3333-3333-333333333333" in the active empresa
    And the editor has stored metadados for project "33333333-3333-3333-3333-333333333333" with titulo "Romance Digital" and autor "Maria Silva" and idioma "pt"
    When the editor requests GET metadados for project "33333333-3333-3333-3333-333333333333"
    Then the response status should be 200
    And the response body field "titulo" is "Romance Digital"
    And the response body field "materialized" is true

  Scenario: GET metadados for unknown project returns lazy default not 404
    When the editor requests GET metadados for project "99999999-9999-9999-9999-999999999999"
    Then the response status should be 200
    And the response body field "materialized" is false

  Scenario: PUT metadados stores optional isbn field
    Given a project with id "44444444-4444-4444-4444-444444444444" in the active empresa
    When the editor sends PUT metadados for project "44444444-4444-4444-4444-444444444444" with titulo "Titulo" and autor "Autor" and idioma "pt" and isbn "978-85-0000-000-0"
    Then the response status should be 200
    And the response body field "isbn" is "978-85-0000-000-0"

  Scenario: GET metadados without authorization returns 401
    Given no authenticated user
    When the editor requests GET metadados without token for project "11111111-1111-1111-1111-111111111111"
    Then the response status should be 401

  Scenario Outline: PUT metadados with invalid idioma returns 400
    Given a project with id "55555555-5555-5555-5555-555555555555" in the active empresa
    When the editor sends PUT metadados for project "55555555-5555-5555-5555-555555555555" with titulo "T" and autor "A" and idioma <idioma>
    Then the response status should be 400

    Examples:
      | idioma |
      | "xx"   |
