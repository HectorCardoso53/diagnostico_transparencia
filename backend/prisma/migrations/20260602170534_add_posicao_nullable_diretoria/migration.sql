-- DropForeignKey
ALTER TABLE "form_responses" DROP CONSTRAINT "form_responses_diretoria_id_fkey";

-- AlterTable
ALTER TABLE "form_responses" ALTER COLUMN "diretoria_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "form_schemas" ADD COLUMN     "posicao" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_diretoria_id_fkey" FOREIGN KEY ("diretoria_id") REFERENCES "diretorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
