-- =============================================================================
-- Migration 0001: create_projeto_editorial
-- Service:   proj-service
-- Source:    docs/architecture/backend/services/proj-service/contracts/data-model.md §2.1
--
-- Creates the aggregate root table for the PROJ bounded context.
-- This table is the cascade root: IMP/COMP/PUB declare FK (projeto_id)
-- REFERENCES projeto_editorial(id) ON DELETE CASCADE in their own migrations.
-- =============================================================================

-- schema: empresa (applied per emp_<slug> schema via EmpresaContext / SET search_path)
CREATE TABLE projeto_editorial (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    editora_id    UUID        NOT NULL,
    nome          TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'rascunho',
    descricao     TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_projeto_status CHECK (status IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_projeto_nome   CHECK (length(btrim(nome)) > 0)
);

CREATE INDEX idx_projeto_editorial_editora        ON projeto_editorial (editora_id);
CREATE INDEX idx_projeto_editorial_status         ON projeto_editorial (status);
CREATE INDEX idx_projeto_editorial_atualizado_em  ON projeto_editorial (atualizado_em DESC);

COMMENT ON TABLE  projeto_editorial            IS 'Editorial project (aggregate root, PROJ context). Cascade root for LGPD erasure; sole authority over status (ADR-002).';
COMMENT ON COLUMN projeto_editorial.status     IS 'Authoritative lifecycle status; only PROJ writes it. Transitions via ProjectStatus VO (ADR-002).';
COMMENT ON COLUMN projeto_editorial.editora_id IS 'Logical reference to editora (cordele_global registry); validated application-side (cross-schema, not a DB FK).';
