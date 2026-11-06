import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, inject } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { seed, DEMO_PASSWORD } from '../seed/seed.js';

export const app = createApp();

/** Connects to a fresh database for this test file and loads the demo seed. */
export function useSeededDb() {
  const ctx = {};
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `t_${randomUUID().slice(0, 8)}` });
    Object.assign(ctx, await seed());
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
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
