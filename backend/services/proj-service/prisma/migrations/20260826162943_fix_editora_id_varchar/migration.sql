-- DropForeignKey
ALTER TABLE "projeto_status_historico" DROP CONSTRAINT "fk_psh_projeto";

-- AlterTable
ALTER TABLE "projeto_editorial" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "editora_id" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "projeto_status_historico" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "proj_proj" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "code" VARCHAR(64),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(255),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" VARCHAR(255),

    CONSTRAINT "proj_proj_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proj_proj_empresaId_active_idx" ON "proj_proj"("empresaId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "proj_proj_empresaId_code_key" ON "proj_proj"("empresaId", "code");

-- AddForeignKey
ALTER TABLE "projeto_status_historico" ADD CONSTRAINT "projeto_status_historico_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projeto_editorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_projeto_editorial_atualizado_em" RENAME TO "projeto_editorial_atualizado_em_idx";

-- RenameIndex
ALTER INDEX "idx_projeto_editorial_editora" RENAME TO "projeto_editorial_editora_id_idx";

-- RenameIndex
ALTER INDEX "idx_projeto_editorial_status" RENAME TO "projeto_editorial_status_idx";

-- RenameIndex
ALTER INDEX "idx_psh_criado_em" RENAME TO "projeto_status_historico_projeto_id_criado_em_idx";

-- RenameIndex
ALTER INDEX "idx_psh_projeto" RENAME TO "projeto_status_historico_projeto_id_idx";
