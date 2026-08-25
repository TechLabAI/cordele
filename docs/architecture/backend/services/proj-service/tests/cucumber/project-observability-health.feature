# Covers SPEC-07: health endpoints (clause 1), X-Correlation-Id propagation (clause 2),
# transition audit logging (clause 3), and erasure step logging (clause 5).
Feature: Observability and health

Background:
  Given the proj-service is running

Scenario: Liveness probe always returns 200
  # SPEC-07 clause 1 — liveness must respond regardless of downstream availability
  When a GET request is sent to /health/live
  Then the response status is 200

Scenario: Readiness probe reflects database reachability only
  # SPEC-07 clause 1 — readiness depends on DB, not on cross-context port health
  Given the database is reachable
  And all cross-context ports are unavailable
  When a GET request is sent to /health/ready
  Then the response status is 200

Scenario: Readiness probe returns 503 when the database is unreachable
  # SPEC-07 clause 1 — DB down → service not ready
  Given the database is unreachable
  When a GET request is sent to /health/ready
  Then the response status is 503

Scenario: Every response echoes the incoming X-Correlation-Id header
  # SPEC-07 clause 2 — correlationId must be propagated on every response
  Given an authenticated editor of empresa "aetos"
  And the request carries X-Correlation-Id "test-corr-id-123"
  When the editor lists projects
  Then the response header X-Correlation-Id is "test-corr-id-123"

Scenario: A status transition is logged with audit fields
  # SPEC-07 clause 3 — log entry must include statusDe, statusPara, solicitadoPor, correlationId
  Given an authenticated editor of empresa "aetos"
  And an existing project "proj-1" in status "rascunho"
  And the request carries X-Correlation-Id "audit-corr-456"
  When the imp context advances project "proj-1" to "em_composicao"
  Then the application log contains a structured entry with fields statusDe "rascunho", statusPara "em_composicao", solicitadoPor, and correlationId "audit-corr-456"

Scenario: Each erasure step is logged with outcome
  # SPEC-07 clause 5 — PROJ must log every purge step and the final completed|aborted outcome
  Given an authenticated principal of empresa "aetos" with scope "proj:delete"
  And an existing project "proj-1" with imported manuscripts and publications
  When the principal deletes project "proj-1"
  Then the application log records the purge of PUB, the purge of COMP, the purge of IMP, and the final outcome "completed"
