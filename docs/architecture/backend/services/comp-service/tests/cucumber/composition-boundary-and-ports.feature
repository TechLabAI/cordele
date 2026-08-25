# Covers SPEC-01/09/10. COMP boundary: never changes status; exports read ports to PUB; idempotent erasure for PROJ.
Feature: Composition boundary and in-process ports

Background:
  Given an authenticated editor of empresa "aetos"
  And a project "proj-1" in status "em_composicao"

Scenario: No composition operation changes the project status
  When the editor saves metadata titulo "Livro" autor "Autor" idioma "pt"
  And the editor saves a valid layout
  Then the project status remains "em_composicao"
  And COMP never calls advanceTo on the project

Scenario: PUB reads metadata at export through the in-process port
  Given metadata already saved for project "proj-1"
  When the pub context calls GetMetadados for project "proj-1"
  Then the persisted metadata is returned
  And COMP tables are not read directly by pub

Scenario: PUB reads layout and receives only non-stale honoured overrides
  Given a saved layout with an image override on "img-017"
  And a saved layout override on "img-042" whose node was removed
  When the pub context calls GetConfiguracaoLayout for project "proj-1"
  Then the returned layout includes the override on "img-017"
  And the returned layout excludes the stale override on "img-042"

Scenario: PUB reading composition of a never-composed project gets null
  Given a project "proj-2" with no composition
  When the pub context calls GetMetadados for project "proj-2"
  Then null is returned

Scenario: PROJ purges composition data idempotently during LGPD erasure
  Given metadata and layout and a cover exist for project "proj-1"
  When the proj context purges composition for project "proj-1"
  Then the metadata layout and overrides are deleted
  And the cover binary is deleted from storage
  When the proj context purges composition for project "proj-1" again
  Then the purge completes without error

Scenario: PROJ requests library author metadata batched
  Given metadata with autor "Eliana Moraes" for project "proj-1"
  When the proj context requests metadata for projects "proj-1,proj-2"
  Then the author for "proj-1" is "Eliana Moraes"
  And "proj-2" is omitted because it has no metadata

# SPEC-04.C6: FK backstop cascade when projeto_editorial is deleted
Scenario: Deleting a projeto_editorial cascades and removes all COMP rows
  Given metadata and layout and overrides exist for project "proj-del"
  When the projeto_editorial for "proj-del" is deleted
  Then the metadados row for "proj-del" does not exist
  And the configuracao_layout row for "proj-del" does not exist
  And the layout_override rows for "proj-del" do not exist

# SPEC-09.C2: rollback must suppress event emission
Scenario: A upsert that rolls back does not publish an event
  Given a metadata write that will be rolled back due to a constraint violation
  When the write is attempted for project "proj-1"
  Then the response indicates an error
  And no MetadataUpdated event is emitted

# SPEC-09.C4 / SPEC-05.C7: every event carries a unique eventId
Scenario: Each emitted event carries a distinct eventId
  Given project "proj-1" with no prior composition
  And project "proj-2" with no prior composition
  When the editor saves metadata for project "proj-1"
  And the editor saves metadata for project "proj-2"
  Then the MetadataUpdated event for "proj-1" and the one for "proj-2" have different eventIds
