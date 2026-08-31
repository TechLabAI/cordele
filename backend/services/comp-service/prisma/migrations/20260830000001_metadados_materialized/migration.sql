-- =============================================================================
-- Migration: metadados_materialized
-- Service:   comp-service
-- Date:      2026-08-30
--
-- Adds the `materialized` column to the `metadados` table and relaxes the
-- overly strict DB-level CHECK constraints for `titulo` and `autor`.
--
-- Rationale:
--   The `materialized` flag distinguishes a lazy-default row (created by
--   UploadCoverUseCase before any PUT /metadados call) from a fully materialized
--   row (created by UpdateMetadadosUseCase). Without this column the Prisma mapper
--   always returns `materialized=true` for every DB row, breaking the lazy-default
--   contract (D-M).
--
--   The CHECK constraints `chk_metadados_titulo` and `chk_metadados_autor` are
--   dropped because they apply to ALL rows, including non-materialized ones that
--   legitimately carry empty titulo/autor strings. The business rule "non-blank
--   titulo and autor are required once the row is materialized" is already enforced
--   at the application layer by `Metadados.assertMaterializedInvariants()`, which
--   fires when `materialized=true`. DB-level enforcement is therefore redundant and
--   prevents the cover-upload use case from creating a lazy-default row.
-- =============================================================================

-- Add the materialized column (false = lazy-default, true = editor has PUT metadata).
ALTER TABLE metadados ADD COLUMN IF NOT EXISTS materialized BOOLEAN NOT NULL DEFAULT false;

-- Remove DB-level CHECK constraints whose business rule is already enforced at the
-- application layer (assertMaterializedInvariants — fires only when materialized=true).
ALTER TABLE metadados DROP CONSTRAINT IF EXISTS chk_metadados_titulo;
ALTER TABLE metadados DROP CONSTRAINT IF EXISTS chk_metadados_autor;
