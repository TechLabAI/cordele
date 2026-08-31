# BDD acceptance tests for the ConfiguracaoLayout API.
# Covers api-contract §4.5-§4.6, SPEC-03 (layout domain), D-H (em-branco rejected), D-M (lazy defaults).
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Layout and Image Alignment Overrides

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: GET layout for new project returns lazy default with materialized false
    Given a project with id "11111111-1111-1111-1111-111111111112" in the active empresa
    When the editor requests GET layout for project "11111111-1111-1111-1111-111111111112"
    Then the response status should be 200
    And the response body field "materialized" is false
    And the response body field "projetoId" is "11111111-1111-1111-1111-111111111112"

  Scenario: PUT layout stores configuration and returns materialized true
    Given a project with id "22222222-2222-2222-2222-222222222223" in the active empresa
    When the editor sends PUT layout for project "22222222-2222-2222-2222-222222222223" with default typography
    Then the response status should be 200
    And the response body field "materialized" is true

  Scenario: GET layout after PUT returns persisted data
    Given a project with id "33333333-3333-3333-3333-333333333334" in the active empresa
    And the editor has stored layout for project "33333333-3333-3333-3333-333333333334" with fonteCorpoTamanho "14"
    When the editor requests GET layout for project "33333333-3333-3333-3333-333333333334"
    Then the response status should be 200
    And the response body field "fonteCorpoTamanho" is 14
    And the response body field "materialized" is true

  Scenario: PUT layout with tipo em-branco override returns 422
    Given a project with id "44444444-4444-4444-4444-444444444445" in the active empresa
    When the editor sends PUT layout for project "44444444-4444-4444-4444-444444444445" with override tipo "em-branco"
    Then the response status should be 422
    And the response body field "title" is "EM_BRANCO_NAO_SUPORTADO"

  Scenario: PUT layout without overrides returns empty overrides list
    Given a project with id "55555555-5555-5555-5555-555555555556" in the active empresa
    When the editor sends PUT layout for project "55555555-5555-5555-5555-555555555556" with default typography
    Then the response status should be 200
    And the response body field "overrides" is an empty array

  Scenario Outline: PUT layout with invalid typography field value returns 400
    Given a project with id "66666666-6666-6666-6666-666666666667" in the active empresa
    When the editor sends PUT layout for project "66666666-6666-6666-6666-666666666667" with field <field> equal to <value>
    Then the response status should be 400

    Examples:
      | field               | value |
      | "fonteCorpoTamanho" | 5     |
