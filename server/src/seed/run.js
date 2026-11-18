/* npm run seed — wipes the database in DATABASE_URL and loads demo data. Run `npm run db:deploy` first. */
import { env, assertEnv } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { seed, DEMO_USERS, DEMO_PASSWORD } from './seed.js';

if (env.isProd && process.env.SEED_CONFIRM !== 'yes') {
  console.error('Refusing to wipe a production database. Set SEED_CONFIRM=yes to override.');
  process.exit(1);
}

try {
  assertEnv();
  const prisma = await connectDb();
  const [{ db, schema }] = await prisma.$queryRaw`SELECT current_database() AS db, current_schema() AS schema`;
  console.log(`Seeding database "${db}" (schema ${schema}) ...`);
  await seed({ log: (m) => console.log(`  - ${m}`) });
  console.log('\nDemo accounts (password: %s)', DEMO_PASSWORD);
  for (const u of DEMO_USERS) console.log(`  ${u.key.padEnd(4)} ${u.email}`);
  console.log('\nDone.');
  await disconnectDb();
} catch (err) {
  console.error('Seed failed:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
}
