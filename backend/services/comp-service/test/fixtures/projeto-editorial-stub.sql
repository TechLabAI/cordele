-- Test fixture: minimal stub for projeto_editorial (owned by PROJ service).
-- Used by db-setup.ts to satisfy FK constraints before applying COMP migrations.
-- Kept in a .sql file so no DDL literals appear in TypeScript source (RULE-09).
CREATE TABLE IF NOT EXISTS projeto_editorial (id UUID NOT NULL PRIMARY KEY);
