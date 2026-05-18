import { config } from 'dotenv';

config();

// defineConfig omitido: é apenas um type helper — objeto direto é equivalente
export default {
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
};
