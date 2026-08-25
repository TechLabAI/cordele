-- =============================================================================
-- Prisma migration: init
-- Service:   comp-service
-- Generated: 2026-08-25 by node-migration-generator.py (D-545)
-- Source:    comp-service/contracts/data-model.md (3 ```sql``` block(s))
--
-- GENERATED FILE. To change the DDL: edit contracts/data-model.md and re-run
--   python scripts/node-migration-generator.py stub --module <M> --name <name> --force
-- Then keep prisma/schema.prisma in sync via node-entity-generator.py.
-- =============================================================================

-- schema: empresa
CREATE TABLE metadados (
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

CREATE UNIQUE INDEX idx_metadados_projeto ON metadados (projeto_id);

COMMENT ON TABLE  metadados          IS 'Editorial identity of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Never writes projeto_editorial or status.';
COMMENT ON COLUMN metadados.capa_url IS 'Reference to the cover binary in FileStoragePort (ADR-003); bytes never stored in the row. Optional (D-L).';
COMMENT ON COLUMN metadados.isbn     IS 'source: mock (BA) — no ISBN registry lookup in the POC.';

-- schema: empresa
CREATE TABLE configuracao_layout (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id          UUID        NOT NULL,
    fonte_corpo_familia TEXT        NOT NULL DEFAULT 'serif',
    fonte_corpo_tamanho INT         NOT NULL DEFAULT 12,
    espacamento_linha   NUMERIC(3,2) NOT NULL DEFAULT 1.5,
    margem_lateral      INT         NOT NULL DEFAULT 20,
    h1_tamanho          INT         NOT NULL DEFAULT 28,
    h2_tamanho          INT         NOT NULL DEFAULT 22,
    h3_tamanho          INT         NOT NULL DEFAULT 18,
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_cfglayout_projeto     UNIQUE (projeto_id),
    CONSTRAINT chk_cfglayout_familia    CHECK (fonte_corpo_familia IN ('serif', 'sans-serif')),
    CONSTRAINT chk_cfglayout_corpo      CHECK (fonte_corpo_tamanho BETWEEN 12 AND 20),
    CONSTRAINT chk_cfglayout_espacamento CHECK (espacamento_linha BETWEEN 1.2 AND 2.0),
    CONSTRAINT chk_cfglayout_margem     CHECK (margem_lateral BETWEEN 10 AND 40),
    CONSTRAINT chk_cfglayout_h1         CHECK (h1_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h2         CHECK (h2_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h3         CHECK (h3_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_heading_order CHECK (h1_tamanho >= h2_tamanho AND h2_tamanho >= h3_tamanho),
    CONSTRAINT fk_cfglayout_projeto     FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_cfglayout_projeto ON configuracao_layout (projeto_id);

COMMENT ON TABLE  configuracao_layout IS 'Presentation parameters of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Only parameters PUB honours (api-contract §7.3).';
COMMENT ON COLUMN configuracao_layout.margem_lateral IS 'Side margin in mm; bounded 10..40.';

-- schema: empresa
CREATE TABLE layout_override (
    id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    configuracao_layout_id UUID        NOT NULL,
    referencia_no          TEXT        NOT NULL,
    tipo                   TEXT        NOT NULL,
    alinhamento            TEXT,
    ordem                  INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT chk_override_tipo        CHECK (tipo IN ('imagem', 'em-branco')),
    CONSTRAINT chk_override_alinhamento CHECK (alinhamento IS NULL OR alinhamento IN ('full', 'centralizado', 'junto-esquerda', 'junto-direita')),
    CONSTRAINT chk_override_imagem_alinhado CHECK (tipo <> 'imagem' OR alinhamento IS NOT NULL),
    CONSTRAINT chk_override_ordem       CHECK (ordem >= 0),
    CONSTRAINT fk_override_cfglayout    FOREIGN KEY (configuracao_layout_id) REFERENCES configuracao_layout (id) ON DELETE CASCADE
);

CREATE INDEX        idx_override_cfglayout ON layout_override (configuracao_layout_id, ordem);
CREATE UNIQUE INDEX uq_override_no         ON layout_override (configuracao_layout_id, referencia_no);

COMMENT ON TABLE  layout_override             IS 'Page/image presentation overrides referencing IMP content nodes (read reference, never a write — ADR-002). MVP writes tipo=imagem only; em-branco reserved/deferred (D-H).';
COMMENT ON COLUMN layout_override.referencia_no IS 'Read reference to a node in IMP''s content tree; validated via ManuscriptContentPort (read-only). Never a write to IMP.';
COMMENT ON COLUMN layout_override.tipo          IS 'imagem (per-image alignment, MVP) | em-branco (blank-page insert, reserved/deferred — rejected on write in POC).';
