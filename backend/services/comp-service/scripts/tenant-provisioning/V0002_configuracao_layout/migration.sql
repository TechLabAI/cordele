-- =============================================================================
-- V0002: Create configuracao_layout table
-- Service:   comp-service
-- Source:    contracts/data-model.md §2.2
-- Applied:   via 20260825141357_init (all 3 tables in combined initial migration)
-- This file is the canonical reference split for tenant provisioning (INT-COMP-006).
-- =============================================================================

-- schema: empresa (emp_<slug>)
CREATE TABLE IF NOT EXISTS configuracao_layout (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    projeto_id          UUID         NOT NULL,
    fonte_corpo_familia TEXT         NOT NULL DEFAULT 'serif',
    fonte_corpo_tamanho INT          NOT NULL DEFAULT 12,
    espacamento_linha   NUMERIC(3,2) NOT NULL DEFAULT 1.5,
    margem_lateral      INT          NOT NULL DEFAULT 20,
    h1_tamanho          INT          NOT NULL DEFAULT 28,
    h2_tamanho          INT          NOT NULL DEFAULT 22,
    h3_tamanho          INT          NOT NULL DEFAULT 18,
    atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_cfglayout_projeto      UNIQUE (projeto_id),
    CONSTRAINT chk_cfglayout_familia     CHECK (fonte_corpo_familia IN ('serif', 'sans-serif')),
    CONSTRAINT chk_cfglayout_corpo       CHECK (fonte_corpo_tamanho BETWEEN 12 AND 20),
    CONSTRAINT chk_cfglayout_espacamento CHECK (espacamento_linha BETWEEN 1.2 AND 2.0),
    CONSTRAINT chk_cfglayout_margem      CHECK (margem_lateral BETWEEN 10 AND 40),
    CONSTRAINT chk_cfglayout_h1          CHECK (h1_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h2          CHECK (h2_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h3          CHECK (h3_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_heading_order CHECK (h1_tamanho >= h2_tamanho AND h2_tamanho >= h3_tamanho),
    CONSTRAINT fk_cfglayout_projeto      FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cfglayout_projeto ON configuracao_layout (projeto_id);

COMMENT ON TABLE  configuracao_layout IS 'Presentation parameters of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Only parameters PUB honours (api-contract §7.3).';
COMMENT ON COLUMN configuracao_layout.margem_lateral IS 'Side margin in mm; bounded 10..40.';
