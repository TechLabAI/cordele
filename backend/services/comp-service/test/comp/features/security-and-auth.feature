# BDD acceptance tests for authentication and authorization of the COMP API.
# Covers SPEC-06 (security model): JWT 401, scope 403, cross-tenant isolation.
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Security and Auth

  Scenario: Request without token returns 401
    When an unauthenticated request is made to GET metadados for project "11111111-1111-1111-1111-111111111111"
    Then the response status should be 401

  Scenario: Valid token with comp read scope can GET metadados
    Given an authenticated editor of empresa "aetos" with scope "comp:read"
    And a project with id "22222222-2222-2222-2222-222222222222" in the active empresa
    When the editor requests GET metadados for project "22222222-2222-2222-2222-222222222222"
    Then the response status should be 200

  Scenario: Valid token with only read scope cannot PUT metadados and returns 403
    Given an authenticated editor of empresa "aetos" with scope "comp:read"
    And a project with id "33333333-3333-3333-3333-333333333333" in the active empresa
    When the editor sends PUT metadados for project "33333333-3333-3333-3333-333333333333" with titulo "T" and autor "A" and idioma "pt"
    Then the response status should be 403

  Scenario: Cross-tenant project access returns isolated lazy default
    Given an authenticated editor of empresa "aetos" with scope "comp:read,comp:write"
    And a project with id "44444444-4444-4444-4444-444444444444" owned by empresa "other" with titulo "Other Data"
    When the editor requests GET metadados for project "44444444-4444-4444-4444-444444444444"
    Then the response status should be 200
    And the response body field "materialized" is false

  Scenario: empresa-admin role can use X-Tenant-Id header to override empresa
    Given an authenticated empresa-admin of empresa "aetos"
    When the admin requests GET metadados for project "55555555-5555-5555-5555-555555555555" with tenant header "other"
    Then the response status should be 200

  Scenario: Valid token with comp write scope can PUT metadados successfully
    Given an authenticated editor of empresa "aetos" with scope "comp:read,comp:write"
    And a project with id "66666666-6666-6666-6666-666666666666" in the active empresa
    When the editor sends PUT metadados for project "66666666-6666-6666-6666-666666666666" with titulo "Titulo" and autor "Autor" and idioma "pt"
    Then the response status should be 200

  Scenario Outline: Write endpoints reject requests with only read scope returning 403
    Given an authenticated editor of empresa "aetos" with scope "comp:read"
    When the editor accesses write endpoint <endpoint> for project "77777777-7777-7777-7777-777777777777"
    Then the response status should be 403

    Examples:
      | endpoint        |
      | "PUT metadados" |
