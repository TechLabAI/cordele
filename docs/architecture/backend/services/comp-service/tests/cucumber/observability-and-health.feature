# Covers SPEC-07.C1 (X-Correlation-Id propagation) and SPEC-07.C3 (ManuscriptContentPort degradation).
# SPEC-07.C2 (readiness endpoint) and SPEC-07.C4 (metric counters) are operational / infrastructure-level;
# they require integration-test tooling and are tracked as advisory gaps for the scaffold phase.
Feature: Observability and graceful degradation

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

# SPEC-07.C1: provided correlation id must be echoed
Scenario: A provided X-Correlation-Id is echoed in the response header
  Given the request carries X-Correlation-Id "corr-abc-123"
  When the editor reads metadata for project "proj-1"
  Then the response status is 200
  And the response header X-Correlation-Id is "corr-abc-123"

# SPEC-07.C1: absent correlation id is generated and returned
Scenario: A request without X-Correlation-Id receives a generated correlation id
  Given the request carries no X-Correlation-Id
  When the editor reads metadata for project "proj-1"
  Then the response status is 200
  And the response header X-Correlation-Id is present and non-empty

# SPEC-07.C3: ManuscriptContentPort unavailable -> preview fails explicitly, not silent 500
Scenario: Preview fails explicitly when ManuscriptContentPort is unavailable
  Given the project has an imported manuscript
  And ManuscriptContentPort is currently unavailable
  When the editor opens the preview for project "proj-1"
  Then the response status is not 200
  And the error body is a well-formed RFC 7807 problem detail, not a silent 500

# SPEC-07.C3: metadata and layout remain readable when ManuscriptContentPort is unavailable
Scenario: Metadata and layout remain readable when ManuscriptContentPort is unavailable
  Given ManuscriptContentPort is currently unavailable
  When the editor reads metadata for project "proj-1"
  Then the response status is 200
  When the editor reads layout for project "proj-1"
  Then the response status is 200
