// =============================================================
//  Prisma Seed — dados iniciais para desenvolvimento
//  Execução: npx prisma db seed
// =============================================================

import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed...');

  // ── Município ──────────────────────────────────────────────
  const municipio = await prisma.municipio.upsert({
    where: { ibge_code: '1500602' },
    update: {},
    create: {
      nome: 'Município Exemplo',
      uf: 'PA',
      ibge_code: '1500602',
    },
  });
  console.log('✅ Município criado:', municipio.nome);

  // ── Secretarias ────────────────────────────────────────────
  const secSaude = await prisma.secretaria.create({
    data: {
      municipio_id: municipio.id,
      nome: 'Secretaria Municipal de Saúde',
      sigla: 'SEMSAU',
    },
  });

  const secEducacao = await prisma.secretaria.create({
    data: {
      municipio_id: municipio.id,
      nome: 'Secretaria Municipal de Educação',
      sigla: 'SEMED',
    },
  });
  console.log('✅ Secretarias criadas');

  // ── Diretorias ─────────────────────────────────────────────
  const dirAtencaoBasica = await prisma.diretoria.create({
    data: {
      secretaria_id: secSaude.id,
      nome: 'Diretoria de Atenção Básica',
      sigla: 'DAB',
    },
  });

  const dirVigilancia = await prisma.diretoria.create({
    data: {
      secretaria_id: secSaude.id,
      nome: 'Diretoria de Vigilância em Saúde',
      sigla: 'DVS',
    },
  });

  await prisma.diretoria.create({
    data: {
      secretaria_id: secEducacao.id,
      nome: 'Diretoria de Ensino Fundamental',
      sigla: 'DEF',
    },
  });
  console.log('✅ Diretorias criadas');

  // ── Usuários ───────────────────────────────────────────────
  const senhaHash = await bcrypt.hash('senha123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@sistema.gov.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@sistema.gov.br',
      senha_hash: senhaHash,
      role: Role.SUPER_ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'secretario.saude@sistema.gov.br' },
    update: {},
    create: {
      nome: 'Secretário de Saúde',
      email: 'secretario.saude@sistema.gov.br',
      senha_hash: senhaHash,
      role: Role.SECRETARIO,
      secretaria_id: secSaude.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'diretor.dab@sistema.gov.br' },
    update: {},
    create: {
      nome: 'Diretor de Atenção Básica',
      email: 'diretor.dab@sistema.gov.br',
      senha_hash: senhaHash,
      role: Role.DIRETOR,
      secretaria_id: secSaude.id,
      diretoria_id: dirAtencaoBasica.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'operador.dab@sistema.gov.br' },
    update: {},
    create: {
      nome: 'Operador DAB',
      email: 'operador.dab@sistema.gov.br',
      senha_hash: senhaHash,
      role: Role.OPERADOR,
      secretaria_id: secSaude.id,
      diretoria_id: dirAtencaoBasica.id,
    },
  });
  console.log('✅ Usuários criados');

  // ── Formulário de exemplo ──────────────────────────────────
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@sistema.gov.br' },
  });

  await prisma.formSchema.create({
    data: {
      secretaria_id: secSaude.id,
      criado_por_id: adminUser!.id,
      titulo: 'Diagnóstico de Atenção Básica 2025',
      descricao: 'Formulário de diagnóstico situacional das unidades de saúde',
      status: 'PUBLICADO',
      publicado_em: new Date(),
      schema_json: {
        sections: [
          {
            id: 'secao_identificacao',
            titulo: 'Identificação',
            campos: [
              {
                id: 'nome_unidade',
                tipo: 'text',
                label: 'Nome da unidade de saúde',
                obrigatorio: true,
                validacoes: { minLength: 3, maxLength: 200 },
              },
              {
                id: 'tipo_unidade',
                tipo: 'select',
                label: 'Tipo de unidade',
                obrigatorio: true,
                opcoes: ['UBS', 'UBSF', 'ESF', 'NASF', 'CEO'],
              },
              {
                id: 'municipio',
                tipo: 'text',
                label: 'Município',
                obrigatorio: true,
              },
            ],
          },
          {
            id: 'secao_estrutura',
            titulo: 'Estrutura física',
            campos: [
              {
                id: 'possui_sala_vacina',
                tipo: 'radio',
                label: 'Possui sala de vacina?',
                obrigatorio: true,
                opcoes: ['Sim', 'Não', 'Em reforma'],
              },
              {
                id: 'num_consultorios',
                tipo: 'number',
                label: 'Quantidade de consultórios',
                obrigatorio: true,
                validacoes: { min: 0, max: 50 },
              },
              {
                id: 'observacoes_estrutura',
                tipo: 'textarea',
                label: 'Observações sobre a estrutura',
                obrigatorio: false,
                validacoes: { maxLength: 1000 },
              },
            ],
          },
          {
            id: 'secao_avaliacao',
            titulo: 'Avaliação geral',
            campos: [
              {
                id: 'avaliacao_geral',
                tipo: 'rating',
                label: 'Avaliação geral da unidade (1 a 5)',
                obrigatorio: true,
                validacoes: { min: 1, max: 5 },
              },
            ],
          },
        ],
      },
      atribuicoes: {
        create: [
          { diretoria_id: dirAtencaoBasica.id },
          { diretoria_id: dirVigilancia.id },
        ],
      },
    },
  });
  console.log('✅ Formulário de exemplo criado');

  console.log('\n🎉 Seed concluído!');
  console.log('   Acesso: admin@sistema.gov.br / senha123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
