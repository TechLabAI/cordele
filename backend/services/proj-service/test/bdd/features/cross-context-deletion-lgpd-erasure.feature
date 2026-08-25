# Covers SPEC-11 (LGPD erasure cascade) and SPEC-05 (idempotency). Closes gap G3.
Feature: Cross-context deletion and LGPD erasure

Background:
  Given an authenticated principal of empresa "aetos" with scope "proj:delete"

Scenario: Deleting a project purges all contexts leaf-first then the identity
  Given an existing project "proj-1" with imported manuscripts, composed metadata and publications
  When the principal deletes project "proj-1"
  Then the response status is 204
  And PUB publications and their ePub artifacts are purged
  And COMP metadata and layout are purged
  And IMP manuscripts and their stored binaries and images are purged
  And the projeto_editorial and its status history are removed
  And the purge order was pub then comp then imp then projeto_editorial
  And a ProjectDeleted event is emitted

Scenario: A project with no downstream data still deletes cleanly
  Given an existing project "proj-2" in status "rascunho" with no manuscript, metadata or publication
  When the principal deletes project "proj-2"
  Then the response status is 204
  And the per-context purges were idempotent no-ops
  And the projeto_editorial is removed

Scenario: A failing purge aborts before the identity is removed
  Given an existing project "proj-1" with imported manuscripts and publications
  And the publication erasure port is unavailable
  When the principal deletes project "proj-1"
  Then the response status is 502
  And project "proj-1" still exists
  And no ProjectDeleted event is emitted

Scenario: A retried deletion after a partial failure completes idempotently
  Given a previous deletion of project "proj-1" purged PUB and COMP but failed on IMP
  When the principal deletes project "proj-1" again
  Then the response status is 204
  And re-purging PUB and COMP were no-ops
  And IMP manuscripts and binaries are purged
  And the projeto_editorial is removed

Scenario: Deletion without the privileged scope is forbidden
  Given the principal's token lacks scope "proj:delete"
  When the principal deletes project "proj-1"
  Then the response status is 403
