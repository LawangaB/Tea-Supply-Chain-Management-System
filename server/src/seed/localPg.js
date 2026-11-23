/**
 * Helpers for throw-away local PostgreSQL (no Docker, no Neon): used by `npm run dev:memory`
 * and by the test suite when DATABASE_URL_TEST is not set.
 * embedded-postgres downloads real PostgreSQL 17 binaries (same major version as production on Neon).
 */
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PRISMA_CLI = path.join(SERVER_DIR, 'node_modules', 'prisma', 'build', 'index.js');

/** Starts a fresh embedded Postgres in a temp folder. Returns { url, stop }. Data is deleted on stop. */
export async function startEmbeddedPostgres({ port = 54329, database = 'smarttea' } = {}) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'smarttea-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir, port, user: 'postgres', password: 'postgres', persistent: false,
    postgresFlags: ['-c', 'max_connections=200'], onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  return {
    url: `postgresql://postgres:postgres@localhost:${port}/${database}`,
    stop: () => pg.stop(),
  };
}

/** Runs `prisma migrate deploy` against `url` (a ?schema=... parameter selects the Postgres schema). */
export async function migrateDeploy(url) {
  await promisify(execFile)(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
