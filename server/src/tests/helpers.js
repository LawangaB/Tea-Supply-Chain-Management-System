import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, inject } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { connectDb, disconnectDb, prisma } from '../config/db.js';
import { seed, DEMO_PASSWORD } from '../seed/seed.js';
import { migrateDeploy } from '../seed/localPg.js';

export const app = createApp();

const withSchema = (url, schema) => `${url}${url.includes('?') ? '&' : '?'}schema=${schema}`;

/**
 * Gives this test file its own Postgres schema: created and migrated with `prisma migrate deploy`,
 * loaded with the demo seed, and dropped afterwards.
 */
export function useSeededDb() {
  const ctx = {};
  const schema = `t_${randomUUID().slice(0, 8)}`;
  beforeAll(async () => {
    const url = withSchema(inject('databaseUrl'), schema);
    await migrateDeploy(url);
    await connectDb(url, { max: 25 });
    Object.assign(ctx, await seed());
  });
  afterAll(async () => {
    await prisma?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await disconnectDb();
  });
  return ctx;
}

export const EMAIL = {
  ADM: 'admin@smarttea.lk', MGT: 'mgt@smarttea.lk', FRM: 'farmer@smarttea.lk', COL: 'col@smarttea.lk',
  FAC: 'fac@smarttea.lk', QO: 'qo@smarttea.lk', WH: 'wh@smarttea.lk', BUY: 'buyer@smarttea.lk', TRN: 'trn@smarttea.lk',
};

/** Returns a supertest agent that holds the session cookie for that role. */
export async function loginAs(role, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email: EMAIL[role], password });
  if (res.status !== 200) throw new Error(`login ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}


export { request };
