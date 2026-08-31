-- =============================================================================
-- V0003: Create layout_override table
-- Service:   comp-service
-- Source:    contracts/data-model.md §2.3
-- Applied:   via 20260825141357_init (all 3 tables in combined initial migration)
-- This file is the canonical reference split for tenant provisioning (INT-COMP-006).
-- Note: CHECK constraint `tipo IN ('imagem', 'em-branco')` is in this SQL file
--       because Prisma does not generate CHECK constraints from schema.prisma.
-- =============================================================================

-- schema: empresa (emp_<slug>)
CREATE TABLE IF NOT EXISTS layout_override (
    id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    configuracao_layout_id UUID        NOT NULL,
    referencia_no          TEXT        NOT NULL,
    tipo                   TEXT        NOT NULL,
    alinhamento            TEXT,
    ordem                  INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT chk_override_tipo            CHECK (tipo IN ('imagem', 'em-branco')),
    CONSTRAINT chk_override_alinhamento     CHECK (alinhamento IS NULL OR alinhamento IN ('full', 'centralizado', 'junto-esquerda', 'junto-direita')),
    CONSTRAINT chk_override_imagem_alinhado CHECK (tipo <> 'imagem' OR alinhamento IS NOT NULL),
    CONSTRAINT chk_override_ordem           CHECK (ordem >= 0),
    CONSTRAINT fk_override_cfglayout        FOREIGN KEY (configuracao_layout_id) REFERENCES configuracao_layout (id) ON DELETE CASCADE
);

CREATE INDEX        IF NOT EXISTS idx_override_cfglayout ON layout_override (configuracao_layout_id, ordem);
CREATE UNIQUE INDEX IF NOT EXISTS uq_override_no         ON layout_override (configuracao_layout_id, referencia_no);

COMMENT ON TABLE  layout_override             IS 'Page/image presentation overrides referencing IMP content nodes (read reference, never a write — ADR-002). MVP writes tipo=imagem only; em-branco reserved/deferred (D-H).';
COMMENT ON COLUMN layout_override.referencia_no IS 'Read reference to a node in IMP content tree; validated via ManuscriptContentPort (read-only). Never a write to IMP.';
COMMENT ON COLUMN layout_override.tipo          IS 'imagem (per-image alignment, MVP) | em-branco (blank-page insert, reserved/deferred — rejected on write in POC).';
