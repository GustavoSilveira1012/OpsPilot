import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const localDatabaseUrl =
  'postgresql://opspilot:opspilot_local@localhost:5432/opspilot?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
