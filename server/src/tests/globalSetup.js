import { startEmbeddedPostgres } from '../seed/localPg.js';

/**
 * One PostgreSQL server for the whole run. Each test file creates, migrates and drops its own
 * schema on it (helpers.js), so files run in parallel without sharing data.
 *   - DATABASE_URL_TEST set (CI service container, local Docker, a Neon branch): use that server.
 *   - otherwise: start a throw-away embedded PostgreSQL 17 (no Docker needed).
 */
let embedded;

export async function setup({ provide }) {
  let url = process.env.DATABASE_URL_TEST;
  if (!url) {
    embedded = await startEmbeddedPostgres({ port: Number(process.env.TEST_PG_PORT) || 54330, database: 'smarttea_test' });
    url = embedded.url;
  }
  provide('databaseUrl', url);
}

export async function teardown() {
  await embedded?.stop();
}
