import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@sistema.gov.br' },
    update: {
      nome: 'Administrador',
      senha_hash: senhaHash,
      role: 'SUPER_ADMIN',
      ativo: true,
      refresh_token: null,
    },
    create: {
      nome: 'Administrador',
      email: 'admin@sistema.gov.br',
      senha_hash: senhaHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Admin criado/restaurado:', user.email);
  console.log('   E-mail: admin@sistema.gov.br');
  console.log('   Senha:  admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect());
