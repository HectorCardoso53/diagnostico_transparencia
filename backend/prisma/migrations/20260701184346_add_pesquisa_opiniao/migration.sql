-- CreateEnum
CREATE TYPE "PesquisaStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "pesquisas_opiniao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "schema_json" JSONB NOT NULL,
    "status" "PesquisaStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criado_por_id" TEXT NOT NULL,
    "publicado_em" TIMESTAMP(3),
    "encerrado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesquisas_opiniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_opiniao" (
    "id" TEXT NOT NULL,
    "pesquisa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "secretaria" TEXT,
    "diretoria" TEXT,
    "cargo" TEXT,
    "dados_json" JSONB NOT NULL,
    "token_browser" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_opiniao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pesquisas_opiniao" ADD CONSTRAINT "pesquisas_opiniao_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_opiniao" ADD CONSTRAINT "respostas_opiniao_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas_opiniao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
