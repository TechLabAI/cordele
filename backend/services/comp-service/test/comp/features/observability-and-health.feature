# BDD acceptance tests for observability: correlation IDs and RFC 7807 error format.
# Covers COMP-018 (correlation), COMP-019 (health/metrics), P7 requirements.
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Observability and Health

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: Successful response includes X-Correlation-Id header
    Given a project with id "11111111-1111-1111-1111-bbbbbbbbbbbb" in the active empresa
    When the editor requests GET metadados for project "11111111-1111-1111-1111-bbbbbbbbbbbb"
    Then the response status should be 200
    And the response header "x-correlation-id" is present

  Scenario: Custom X-Correlation-Id sent in request is echoed in response
    Given a project with id "22222222-2222-2222-2222-cccccccccccc" in the active empresa
    When the editor requests GET metadados for project "22222222-2222-2222-2222-cccccccccccc" with correlation id "custom-trace-id-123"
    Then the response status should be 200
    And the response header "x-correlation-id" equals "custom-trace-id-123"

  Scenario: Domain error 422 returns application problem json with traceId
    Given a project with id "33333333-3333-3333-3333-dddddddddddd" in the active empresa
    When the editor sends PUT layout for project "33333333-3333-3333-3333-dddddddddddd" with override tipo "em-branco"
    Then the response status should be 422
    And the response content type is "application/problem+json"
    And the response body contains field "traceId"
    And the response body contains field "type"
    And the response body contains field "title"

  Scenario: Problem detail response has all RFC 7807 required fields
    Given a project with id "44444444-4444-4444-4444-eeeeeeeeeeee" in the active empresa
    When the editor sends PUT layout for project "44444444-4444-4444-4444-eeeeeeeeeeee" with override tipo "em-branco"
    Then the response status should be 422
    And the response body field "type" starts with "urn:cordele:comp:"
    And the response body field "status" is 422
    And the response body contains field "traceId"

  Scenario Outline: Domain error title field contains the error code
    Given a project with id "55555555-5555-5555-5555-ffffffffffff" in the active empresa
    When the editor sends PUT layout for project "55555555-5555-5555-5555-ffffffffffff" with override tipo "em-branco"
    Then the response status should be 422
    And the response body field "title" is <errorCode>

    Examples:
      | errorCode                  |
      | "EM_BRANCO_NAO_SUPORTADO"  |
