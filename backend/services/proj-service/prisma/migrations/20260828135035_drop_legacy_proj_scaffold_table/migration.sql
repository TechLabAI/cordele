-- Removes the scaffold-generated `Proj` reference entity (proj_proj table).
-- Superseded since P3 by the real ProjetoEditorial aggregate; the legacy CRUD
-- adapter (PrismaProjRepository / ProjService) was dead code, never wired to
-- ProjController, and has been removed from the application layer.
-- DropTable
DROP TABLE "proj_proj";
