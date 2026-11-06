/* npm run seed — wipes the database in MONGODB_URI and loads demo data. */
import { env, assertEnv } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { seed, DEMO_USERS, DEMO_PASSWORD } from './seed.js';

if (env.isProd && process.env.SEED_CONFIRM !== 'yes') {
  console.error('Refusing to wipe a production database. Set SEED_CONFIRM=yes to override.');
  process.exit(1);
}

try {
  assertEnv();
  const conn = await connectDb();
  console.log(`Seeding database "${conn.name}" ...`);
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
