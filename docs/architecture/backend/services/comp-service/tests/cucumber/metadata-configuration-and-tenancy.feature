# Covers SPEC-02 (metadata) and SPEC-06 (tenancy). Anchor event MetadataUpdated. COMP never changes status.
Feature: Editorial metadata configuration and tenant isolation

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

Scenario: Saving valid metadata upserts and emits MetadataUpdated
  When the editor saves metadata titulo "Romance das Cidades" autor "Eliana Moraes" idioma "pt"
  Then the response status is 200
  And the metadata is persisted for project "proj-1"
  And a MetadataUpdated event is emitted
  And the project status is unchanged

Scenario: Title and author are required
  When the editor saves metadata titulo "" autor "Eliana Moraes" idioma "pt"
  Then the response status is 400
  And nothing is persisted

Scenario: Language must be one of pt, en, es, fr
  When the editor saves metadata titulo "Contos" autor "Marina" idioma "de"
  Then the response status is 400

Scenario Outline: Accepted languages
  When the editor saves metadata titulo "Livro" autor "Autor" idioma "<idioma>"
  Then the response status is 200

  Examples:
    | idioma |
    | pt     |
    | en     |
    | es     |
    | fr     |

Scenario: Reading metadata before any save returns a default representation
  When the editor reads metadata for project "proj-1"
  Then the response status is 200
  And the metadata field "materialized" is false

Scenario: A project of another empresa is not reachable
  Given a project "proj-x" belonging to empresa "outra"
  When the editor reads metadata for project "proj-x"
  Then the response status is 404

Scenario: Re-sending identical metadata is an idempotent no-op
  Given metadata already saved for project "proj-1"
  When the editor saves the same metadata again
  Then the response status is 200
  And the metadata is unchanged
