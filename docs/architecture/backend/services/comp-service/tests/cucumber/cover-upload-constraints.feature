# Covers SPEC-02 (cover) and SPEC-06 (upload validation). Cover is optional; behind FileStoragePort (ADR-003, D-L).
Feature: Cover image upload constraints

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

Scenario: Uploading a valid cover stores it and sets capaUrl
  When the editor uploads a cover "capa.jpg" of type "image/jpeg" sized 2 MB
  Then the response status is 201
  And the metadata capaUrl references a stored object
  And a MetadataUpdated event is emitted

Scenario: The cover binary is not stored in the relational row
  When the editor uploads a cover "capa.png" of type "image/png" sized 3 MB
  Then the stored metadata row holds only capaUrl, not the image bytes

Scenario Outline: Only jpeg, png and webp are accepted
  When the editor uploads a cover "arquivo" of type "<mime>" sized 1 MB
  Then the response status is <status>

  Examples:
    | mime         | status |
    | image/jpeg   | 201    |
    | image/png    | 201    |
    | image/webp   | 201    |
    | image/gif    | 415    |
    | application/pdf | 415 |

Scenario: A cover over 10 MB is rejected
  When the editor uploads a cover "capa-grande.png" of type "image/png" sized 12 MB
  Then the response status is 413
  And nothing is stored

Scenario: The cover is optional — metadata can be saved without one
  When the editor saves metadata titulo "Sem Capa" autor "Autor" idioma "pt"
  Then the response status is 200
  And the metadata capaUrl is null

Scenario: Removing the cover clears capaUrl idempotently
  Given a cover already uploaded for project "proj-1"
  When the editor removes the cover
  Then the response status is 204
  And the metadata capaUrl is null
  When the editor removes the cover again
  Then the response status is 204
