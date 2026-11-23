/*
 * npm run dev:memory — runs the API on a throw-away local PostgreSQL 17 (embedded-postgres, no Docker
 * or internet needed after the first install), migrated and loaded with the demo seed.
 * Handy as a demo-day fallback. Data is deleted when the process stops.
 */
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { createApp } from '../app.js';
import { seed, DEMO_PASSWORD } from './seed.js';
import { startEmbeddedPostgres, migrateDeploy } from './localPg.js';

if (!env.jwtSecret) env.jwtSecret = 'local-memory-dev-secret';

const pg = await startEmbeddedPostgres({ port: Number(process.env.MEMORY_PG_PORT) || 54329 });
const stop = async () => {
  await disconnectDb().catch(() => {});
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  await migrateDeploy(pg.url);
  await connectDb(pg.url);
  await seed({ log: (m) => console.log(`  - ${m}`) });
  createApp().listen(env.port, () => {
    console.log(`\nAPI (local throw-away PostgreSQL) on http://localhost:${env.port} — demo password ${DEMO_PASSWORD}`);
  });
} catch (err) {
  console.error('dev:memory failed:', err);
  await stop();
}
