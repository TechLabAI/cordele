# Covers SPEC-03 (layout + overrides) and SPEC-04 (bounds). Structural edits deferred (D-H). Manuscript never mutated (ADR-002).
Feature: Layout configuration and image-alignment overrides

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"
  And the project has an imported manuscript with image node "img-017"

Scenario: Saving a valid layout upserts and emits LayoutUpdated
  When the editor saves layout with body size 14 line spacing 1.5 margin 20 and headings 28 22 18
  Then the response status is 200
  And a LayoutUpdated event is emitted
  And the project status is unchanged

Scenario Outline: Typography values must stay within bounds
  When the editor saves layout with body size <size> line spacing <spacing> margin <margin> and headings 28 22 18
  Then the response status is <status>

  Examples:
    | size | spacing | margin | status |
    | 12   | 1.2     | 10     | 200    |
    | 20   | 2.0     | 40     | 200    |
    | 11   | 1.5     | 20     | 400    |
    | 14   | 2.5     | 20     | 400    |
    | 14   | 1.5     | 45     | 400    |

Scenario: Heading sizes must be non-increasing h1 >= h2 >= h3
  When the editor saves layout with headings 18 22 28
  Then the response status is 400

Scenario: An image-alignment override referencing an existing node is accepted
  When the editor saves a layout override referenciaNo "img-017" tipo "imagem" alinhamento "centralizado"
  Then the response status is 200
  And the override is persisted for project "proj-1"

Scenario Outline: All four alignments are accepted for an image override
  When the editor saves a layout override referenciaNo "img-017" tipo "imagem" alinhamento "<alinhamento>"
  Then the response status is 200

  Examples:
    | alinhamento     |
    | full            |
    | centralizado    |
    | junto-esquerda  |
    | junto-direita   |

Scenario: A blank-page insert is deferred in the POC
  When the editor saves a layout override referenciaNo "img-017" tipo "em-branco" alinhamento null
  Then the response status is 422
  And the problem type is "urn:cordele:comp:structural-edit-deferred"

Scenario: An override to a non-existent manuscript node is rejected
  When the editor saves a layout override referenciaNo "img-999" tipo "imagem" alinhamento "full"
  Then the response status is 422
  And the problem type is "urn:cordele:comp:override-ref-not-found"
  And nothing is persisted

Scenario: The manuscript is never mutated by a layout operation
  When the editor saves any valid layout
  Then the imported manuscript content tree is unchanged

# SPEC-04.C3: tipo=imagem with null alinhamento must be rejected (CHECK + domain VO)
Scenario: An image override with null alignment is rejected
  When the editor saves a layout override referenciaNo "img-017" tipo "imagem" alinhamento null
  Then the response status is 400
  And nothing is persisted
