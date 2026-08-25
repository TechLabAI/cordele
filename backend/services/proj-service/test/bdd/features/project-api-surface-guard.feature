# Covers SPEC-01 clause 2 — advanceTo must never be exposed as an HTTP endpoint.
Feature: API surface boundary guard

Background:
  Given an authenticated editor of empresa "aetos"

Scenario: The advanceTo operation is not reachable via HTTP
  # SPEC-01 clause 2 — advanceTo is exclusively an in-process inbound port; no REST route exposes it
  When a POST request is sent to "/api/proj/projetos/proj-1/advance"
  Then the response status is 404
  And the response body does not contain "advanceTo"
