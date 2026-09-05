-- =============================================================================
-- Prisma migration: add_epub_summary_kpi_fields
-- Service:   pub-service
-- Issue:     PUB-021 / ADR-004
-- Generated: 2026-09-03 (manual — implementador P13)
-- Fixed:     2026-09-05 — removido bloco com schema emp_aetos hardcoded (RULE-09 /
--            multi-empresa: DDL nunca qualifica schema de empresa; o search_path da
--            conexão resolve para o schema correto de cada empresa).
--
-- ADR-004: adiciona os 3 campos de KPI de ePub ao aggregate `publicacao`.
-- `paginas` foi deliberadamente omitido (ADR-004 §D-S: remoção permanente).
-- Todos os campos são nullable — nulos até a conclusão do build (status=publicado).
-- =============================================================================

-- Sem qualificação de schema: resolve pelo search_path da conexão Prisma,
-- que é definido por ?schema=emp_<slug> em DATABASE_URL. Desta forma a migration
-- é aplicada ao schema correto de cada empresa, sem hardcoding.
ALTER TABLE IF EXISTS publicacao
  ADD COLUMN IF NOT EXISTS tamanho_bytes    INTEGER,
  ADD COLUMN IF NOT EXISTS total_capitulos  INTEGER,
  ADD COLUMN IF NOT EXISTS total_imagens    INTEGER;

COMMENT ON COLUMN publicacao.tamanho_bytes   IS 'Tamanho do .epub em bytes (ADR-004); nulo enquanto build em andamento ou com_erros.';
COMMENT ON COLUMN publicacao.total_capitulos IS 'Número de capítulos no ePub gerado (ADR-004); nulo enquanto build em andamento ou com_erros.';
COMMENT ON COLUMN publicacao.total_imagens   IS 'Número de imagens referenciadas no ePub gerado (ADR-004); nulo enquanto build em andamento ou com_erros.';
