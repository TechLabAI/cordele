-- =============================================================================
-- Prisma migration: init
-- Service:   pub-service
-- Generated: 2026-08-25 by node-migration-generator.py (D-545)
-- Source:    pub-service/contracts/data-model.md (2 ```sql``` block(s))
--
-- GENERATED FILE. To change the DDL: edit contracts/data-model.md and re-run
--   python scripts/node-migration-generator.py stub --module <M> --name <name> --force
-- Then keep prisma/schema.prisma in sync via node-entity-generator.py.
-- =============================================================================

-- schema: empresa
CREATE TABLE publicacao (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id       UUID        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'gerando',
    epubcheck_status TEXT        NOT NULL DEFAULT 'pendente',
    sequencia        INTEGER     NOT NULL,
    artefato_ref     TEXT,
    resumo_erro      TEXT,
    total_erros      INTEGER     NOT NULL DEFAULT 0,
    total_avisos     INTEGER     NOT NULL DEFAULT 0,
    iniciada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluida_em     TIMESTAMPTZ,
    PRIMARY KEY (id),
    CONSTRAINT chk_publicacao_status    CHECK (status IN ('gerando', 'validando', 'publicado', 'com_erros')),
    CONSTRAINT chk_publicacao_epubcheck CHECK (epubcheck_status IN ('valido', 'avisos', 'erros_criticos', 'pendente')),
    CONSTRAINT chk_publicacao_sequencia CHECK (sequencia >= 1),
    CONSTRAINT chk_publicacao_counts    CHECK (total_erros >= 0 AND total_avisos >= 0),
    CONSTRAINT chk_publicacao_artefato  CHECK ((status = 'publicado') = (artefato_ref IS NOT NULL)),
    CONSTRAINT uq_publicacao_projeto_seq UNIQUE (projeto_id, sequencia),
    CONSTRAINT fk_publicacao_projeto    FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_publicacao_projeto_inflight ON publicacao (projeto_id) WHERE status IN ('gerando', 'validando');
CREATE INDEX idx_publicacao_projeto_status ON publicacao (projeto_id, status);
CREATE INDEX idx_publicacao_projeto_iniciada ON publicacao (projeto_id, iniciada_em DESC);

COMMENT ON TABLE  publicacao                  IS 'ePub export attempt (aggregate root, PUB context). Append-only history; terminal rows are never mutated.';
COMMENT ON COLUMN publicacao.status           IS 'Async build-machine state: gerando -> validando -> publicado | com_erros (ADR-002).';
COMMENT ON COLUMN publicacao.epubcheck_status IS 'epubcheck verdict: valido | avisos | erros_criticos | pendente (ADR-003 / D-Q). avisos still publishes.';
COMMENT ON COLUMN publicacao.artefato_ref     IS 'FileStoragePort key of the .epub; non-null iff status=publicado (chk_publicacao_artefato).';
COMMENT ON COLUMN publicacao.sequencia        IS 'Per-project monotonic attempt number (history / T08).';
COMMENT ON COLUMN publicacao.resumo_erro      IS 'Short human-readable failure summary; set when com_erros.';

-- schema: empresa
CREATE TABLE validation_message (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    publicacao_id UUID        NOT NULL,
    severity      TEXT        NOT NULL,
    code          TEXT        NOT NULL,
    message       TEXT        NOT NULL,
    location      TEXT,
    ordem         INTEGER     NOT NULL DEFAULT 0,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_validation_message_severity CHECK (severity IN ('error', 'warning', 'info')),
    CONSTRAINT fk_validation_message_pub FOREIGN KEY (publicacao_id) REFERENCES publicacao (id) ON DELETE CASCADE
);

CREATE INDEX idx_validation_message_pub_sev ON validation_message (publicacao_id, severity);

COMMENT ON TABLE  validation_message          IS 'epubcheck report, one row per message. Retained with the publicacao for auditability (ADR-003).';
COMMENT ON COLUMN validation_message.severity IS 'error | warning | info (epubcheck message class). error rows drive erros_criticos.';
COMMENT ON COLUMN validation_message.code     IS 'epubcheck message code (e.g. RSC-005, OPF-014).';
COMMENT ON COLUMN validation_message.location IS 'File/line location within the OCF package (nullable).';
