-- CreateEnum
CREATE TYPE "OrgaoTipo" AS ENUM ('SECRETARIA', 'PGM', 'GABINETE');

-- AlterTable
ALTER TABLE "secretarias" ADD COLUMN     "tipo" "OrgaoTipo" NOT NULL DEFAULT 'SECRETARIA';
