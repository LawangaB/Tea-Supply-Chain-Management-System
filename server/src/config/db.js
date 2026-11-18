import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { env } from './env.js';

/**
 * The single shared PrismaClient. Import `prisma` anywhere; call connectDb() once at startup.
 * `prisma` is a live binding, so modules that imported it see the client created by connectDb().
 */
// eslint-disable-next-line import/no-mutable-exports
export let prisma = null;

/**
 * Splits a Prisma-style `?schema=...` parameter (used by the tests for isolation) off the URL:
 * the pg driver does not understand it, the adapter takes the schema as an option instead.
 */
function splitSchema(url) {
  try {
    const u = new URL(url);
    const schema = u.searchParams.get('schema') || undefined;
    u.searchParams.delete('schema');
    return { connectionString: u.toString(), schema };
  } catch {
    return { connectionString: url, schema: undefined };
  }
}

export function createClient(url = env.databaseUrl, { max = 10 } = {}) {
  const { connectionString, schema } = splitSchema(url);
  // With a schema, raw SQL (counters, TRUNCATE) must resolve there too, so set search_path per connection.
  // Only the tests use this; the Neon pooled URL never carries ?schema=.
  const pool = { connectionString, max, ...(schema ? { options: `-c search_path="${schema}"` } : {}) };
  const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
  return new PrismaClient({
    adapter,
    omit: { user: { passwordHash: true } }, // never returned unless a query asks for it (login)
  });
}

export async function connectDb(url = env.databaseUrl, opts = {}) {
  if (prisma) await prisma.$disconnect();
  prisma = createClient(url, opts);
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`; // fail fast on a bad URL
  return prisma;
}

export async function disconnectDb() {
  if (prisma) await prisma.$disconnect();
  prisma = null;
}
