/*
 * npm run dev:memory — runs the API on a throw-away in-memory MongoDB replica set
 * loaded with the demo seed. No Atlas or internet needed (handy as a demo-day fallback).
 * Data is lost when the process stops.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import { createApp } from '../app.js';
import { seed, DEMO_PASSWORD } from './seed.js';

if (!env.jwtSecret) env.jwtSecret = 'local-memory-dev-secret';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
await connectDb(replSet.getUri('smarttea'));
await seed({ log: (m) => console.log(`  - ${m}`) });
createApp().listen(env.port, () => {
  console.log(`\nAPI (in-memory DB) on http://localhost:${env.port} — demo password ${DEMO_PASSWORD}`);
});

const stop = async () => { await replSet.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
