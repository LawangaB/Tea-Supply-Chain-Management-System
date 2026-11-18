// Prisma CLI configuration (Prisma 7). The CLI (migrate, studio) uses the DIRECT (unpooled) connection;
// the running app uses the pooled DATABASE_URL through the pg driver adapter (src/config/db.js).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Plain process.env (not env()) so `prisma generate` also works where no database is configured (npm ci in CI).
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || '' },
});
