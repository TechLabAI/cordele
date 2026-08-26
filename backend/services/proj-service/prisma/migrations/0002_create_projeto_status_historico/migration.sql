-- =============================================================================
-- Migration 0002: create_projeto_status_historico
-- Service:   proj-service
-- Source:    docs/architecture/backend/services/proj-service/contracts/data-model.md §2.2
--
-- Creates the append-only audit table for status transitions.
-- FK with ON DELETE CASCADE: removing a ProjetoEditorial removes all its history.
-- Depends on 0001_create_projeto_editorial (projeto_editorial must exist first).
-- =============================================================================

-- schema: empresa (applied per emp_<slug> schema via EmpresaContext / SET search_path)
CREATE TABLE projeto_status_historico (
    id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id     UUID        NOT NULL,
    status_de      TEXT,
    status_para    TEXT        NOT NULL,
    solicitado_por TEXT        NOT NULL,
    principal_id   TEXT,
    motivo         TEXT,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_psh_status_para   CHECK (status_para IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_psh_status_de     CHECK (status_de IS NULL OR status_de IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_psh_solicitante   CHECK (solicitado_por IN ('imp', 'pub', 'comp', 'editor', 'system')),
    CONSTRAINT fk_psh_projeto FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE INDEX idx_psh_projeto    ON projeto_status_historico (projeto_id);
CREATE INDEX idx_psh_criado_em  ON projeto_status_historico (projeto_id, criado_em DESC);

COMMENT ON TABLE  projeto_status_historico             IS 'Append-only audit of project status transitions (ADR-002 evidence). One row per actual change; none on idempotent no-op.';
COMMENT ON COLUMN projeto_status_historico.status_de   IS 'Previous status; NULL for the creation row (rascunho).';
COMMENT ON COLUMN projeto_status_historico.solicitado_por IS 'Requesting context: imp | pub | comp | editor | system.';
