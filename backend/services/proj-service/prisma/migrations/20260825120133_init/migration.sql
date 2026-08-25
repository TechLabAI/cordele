-- =============================================================================
-- Prisma migration: init
-- Service:   proj-service
-- Generated: 2026-08-25 by node-migration-generator.py (D-545)
-- Source:    proj-service/contracts/data-model.md (2 ```sql``` block(s))
--
-- GENERATED FILE. To change the DDL: edit contracts/data-model.md and re-run
--   python scripts/node-migration-generator.py stub --module <M> --name <name> --force
-- Then keep prisma/schema.prisma in sync via node-entity-generator.py.
-- =============================================================================

-- schema: empresa
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

-- schema: empresa
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

COMMENT ON TABLE  projeto_status_historico             IS 'Append-only audit of project status transitions (ADR-002 evidence; gap G1). One row per actual change; none on idempotent no-op.';
COMMENT ON COLUMN projeto_status_historico.status_de   IS 'Previous status; NULL for the creation row (rascunho).';
COMMENT ON COLUMN projeto_status_historico.solicitado_por IS 'Requesting context: imp | pub | comp | editor | system.';
