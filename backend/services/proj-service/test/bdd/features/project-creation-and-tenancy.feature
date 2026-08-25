# Covers SPEC-01 (create) and SPEC-06 (tenancy). Anchor event ProjectCreated.
Feature: Project creation and tenant isolation

Background:
  Given an authenticated editor of empresa "aetos"

Scenario: Creating a project starts it in draft and anchors identity
  When the editor creates a project named "Romance das Cidades"
  Then the response status is 201
  And the project status is "rascunho"
  And the project is owned by empresa "aetos"
  And a ProjectCreated event is emitted

Scenario: The owning empresa is taken from the token, never the body
  When the editor creates a project named "Poemas do Sertão" with body editoraId "emp-outra"
  Then the project is owned by empresa "aetos"

Scenario: A blank name is rejected
  When the editor creates a project named ""
  Then the response status is 400

Scenario: Import creates a project in-process during create-and-upload
  When the imp context creates a project with titulo "Contos Urbanos"
  Then a projetoId is returned
  And the project status is "rascunho"
  And a ProjectCreated event is emitted

Scenario: A project lookup is scoped to the active empresa
  Given a project "proj-x" belonging to empresa "outra"
  When the imp context checks whether project "proj-x" exists
  Then the lookup returns false
