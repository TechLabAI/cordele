# BDD acceptance tests for COMP service boundaries (ADR-002, D-K, IMP boundary).
# Verifies that COMP reads from IMP via ManuscriptContentPort and never writes to it.
# Runs against a NestJS TestingModule with real PostgreSQL (Testcontainers).
#
# Issue: COMP-020
Feature: Composition Boundary and Ports

  Background:
    Given an authenticated editor of empresa "test" with scope "comp:read,comp:write"

  Scenario: Override referencing existing manuscript node is marked as active in response
    Given a project with id "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" in the active empresa
    When the editor sends PUT layout for project "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" with override for node "node-001" and tipo "imagem"
    Then the response status should be 200
    And the override for node "node-001" is not stale

  Scenario: Override referencing non-existing manuscript node is marked as stale
    Given a project with id "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" in the active empresa
    When the editor sends PUT layout for project "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" with override for node "ghost-node-id" and tipo "imagem"
    Then the response status should be 200
    And the override for node "ghost-node-id" is stale

  Scenario: PUT layout when no manuscript exists marks all overrides as stale
    Given a project with id "cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa" in the active empresa
    And the manuscript stub returns null for project "cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa"
    When the editor sends PUT layout for project "cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa" with override for node "any-node" and tipo "imagem"
    Then the response status should be 200
    And the override for node "any-node" is stale

  Scenario: GET preview-context is read-only and does not create metadados records
    Given a project with id "dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb" in the active empresa
    When the editor requests GET preview-context for project "dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb"
    Then the response status should be 200
    And no metadados record was persisted for project "dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb"

  Scenario: GET preview-context with stale stored override lists it in staleOverrides
    Given a project with id "eeeeeeee-ffff-aaaa-bbbb-cccccccccccc" in the active empresa
    And the editor has stored layout for project "eeeeeeee-ffff-aaaa-bbbb-cccccccccccc" with override referencing node "deleted-node"
    When the editor requests GET preview-context for project "eeeeeeee-ffff-aaaa-bbbb-cccccccccccc"
    Then the response status should be 200
    And the response body field "staleOverrides" is not empty
