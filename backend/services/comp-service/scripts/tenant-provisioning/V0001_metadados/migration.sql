-- =============================================================================
-- V0001: Create metadados table
-- Service:   comp-service
-- Source:    contracts/data-model.md §2.1
-- Applied:   via 20260825141357_init (all 3 tables in combined initial migration)
-- This file is the canonical reference split for tenant provisioning (INT-COMP-006).
-- =============================================================================

-- schema: empresa (emp_<slug>)
CREATE TABLE IF NOT EXISTS metadados (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id    UUID        NOT NULL,
    titulo        TEXT        NOT NULL,
    autor         TEXT        NOT NULL,
    isbn          TEXT,
    idioma        TEXT        NOT NULL DEFAULT 'pt',
    categoria     TEXT,
    capa_url      TEXT,
    editora_nome  TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_metadados_projeto  UNIQUE (projeto_id),
    CONSTRAINT chk_metadados_titulo  CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT chk_metadados_autor   CHECK (length(btrim(autor)) > 0),
    CONSTRAINT chk_metadados_idioma  CHECK (idioma IN ('pt', 'en', 'es', 'fr')),
    CONSTRAINT fk_metadados_projeto  FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metadados_projeto ON metadados (projeto_id);

COMMENT ON TABLE  metadados          IS 'Editorial identity of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Never writes projeto_editorial or status.';
COMMENT ON COLUMN metadados.capa_url IS 'Reference to the cover binary in FileStoragePort (ADR-003); bytes never stored in the row. Optional (D-L).';
COMMENT ON COLUMN metadados.isbn     IS 'source: mock (BA) — no ISBN registry lookup in the POC.';
