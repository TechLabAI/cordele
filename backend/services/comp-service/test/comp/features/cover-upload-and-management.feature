# BDD acceptance tests for the Capa (cover image) API.
# Covers api-contract §4.3-§4.4 and D-L (cover binary via FileStoragePort).
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Cover Upload and Management

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: POST capa uploads cover and returns capaUrl and atualizadoEm
    Given a project with id "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" in the active empresa
    When the editor uploads a cover image for project "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    Then the response status should be 201
    And the response body contains field "capaUrl"
    And the response body contains field "atualizadoEm"

  Scenario: POST capa second upload replaces first cover
    Given a project with id "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" in the active empresa
    And the editor has uploaded a cover for project "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    When the editor uploads a cover image for project "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    Then the response status should be 201
    And the response body contains field "capaUrl"

  Scenario: DELETE capa clears cover and returns 204
    Given a project with id "cccccccc-cccc-cccc-cccc-cccccccccccc" in the active empresa
    And the editor has uploaded a cover for project "cccccccc-cccc-cccc-cccc-cccccccccccc"
    When the editor deletes the cover for project "cccccccc-cccc-cccc-cccc-cccccccccccc"
    Then the response status should be 204

  Scenario: DELETE capa when no cover exists returns 204 idempotent
    Given a project with id "dddddddd-dddd-dddd-dddd-dddddddddddd" in the active empresa
    When the editor deletes the cover for project "dddddddd-dddd-dddd-dddd-dddddddddddd"
    Then the response status should be 204

  Scenario: GET metadados after POST capa shows capaUrl is set
    Given a project with id "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" in the active empresa
    And the editor has uploaded a cover for project "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    When the editor requests GET metadados for project "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    Then the response status should be 200
    And the response body contains field "capaUrl"

  Scenario: POST capa without authorization returns 401
    Given no authenticated user
    When the editor uploads a cover without token for project "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    Then the response status should be 401
