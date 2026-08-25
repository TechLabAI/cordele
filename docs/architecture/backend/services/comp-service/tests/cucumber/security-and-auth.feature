# Covers SPEC-01.C3 (scope gate) and SPEC-06.C2 (401/403). OAuth2 Bearer JWT required; scopes comp:read / comp:write.
Feature: Security and scope enforcement

Background:
  And a project "proj-1" in status "em_composicao" for empresa "aetos"

# SPEC-06.C2: unauthenticated request -> 401
Scenario: An unauthenticated request is rejected with 401
  Given no authentication token is provided
  When the caller reads metadata for project "proj-1"
  Then the response status is 401

# SPEC-01.C3 / SPEC-06.C2: token present but missing any comp scope -> 403
Scenario: A token without any comp scope cannot read metadata
  Given an authenticated principal without any comp scope
  When the caller reads metadata for project "proj-1"
  Then the response status is 403
  And the problem type is "urn:cordele:comp:forbidden"

# SPEC-01.C3: comp:read scope is not sufficient for write operations
Scenario: A comp:read token cannot upsert metadata
  Given an authenticated editor of empresa "aetos" with scope "comp:read" only
  When the editor saves metadata titulo "Livro" autor "Autor" idioma "pt"
  Then the response status is 403
  And the problem type is "urn:cordele:comp:forbidden"

# SPEC-01.C3: comp:write scope allows write
Scenario: A comp:write token can upsert metadata
  Given an authenticated editor of empresa "aetos" with scope "comp:write"
  When the editor saves metadata titulo "Livro" autor "Autor" idioma "pt"
  Then the response status is 200
