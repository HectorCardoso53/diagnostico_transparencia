import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'npx ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
