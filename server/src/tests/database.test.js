/**
 * PostgreSQL-level guarantees: atomic gap-free counters, transaction rollback, CHECK constraints,
 * the append-only audit_log trigger, and the mapping of database errors to API errors.
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { prisma } from '../config/db.js';
import { nextSeq } from '../services/counter.js';
import { recordCollection } from '../services/collection.service.js';
import { mapDatabaseError } from '../middleware/errors.js';
import { $Enums } from '../generated/prisma/index.js';
import * as enums from '../rules/enums.js';
import { ROLE_CODES } from '../rules/permissions.js';
import { useSeededDb, loginAs } from './helpers.js';

const ctx = useSeededDb();
const seqOf = (code) => Number(code.split('-').at(-1));

/** Runs `fn`, expects it to throw, and returns the error. */
async function failure(fn) {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the database to refuse this');
}

describe('atomic counters (services/counter.js)', () => {
  it('30 concurrent transactions get the numbers 1..30 exactly once', async () => {
    const key = `TEST-${randomUUID().slice(0, 6)}`;
    const seqs = await Promise.all(Array.from({ length: 30 }, () => prisma.$transaction((tx) => nextSeq(key, tx))));
    expect([...seqs].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('a rolled-back transaction gives its number back (no gap)', async () => {
    const key = `TEST-${randomUUID().slice(0, 6)}`;
    await prisma.$transaction((tx) => nextSeq(key, tx)); // 1
    await expect(prisma.$transaction(async (tx) => {
      expect(await nextSeq(key, tx)).toBe(2);
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await prisma.$transaction((tx) => nextSeq(key, tx))).toBe(2);
  });

  it('refuses to run outside a transaction', async () => {
    await expect(nextSeq('RC')).rejects.toThrow(/inside a transaction/);
  });
});

describe('recordCollection is all-or-nothing', () => {
  it('a failure after the numbers were taken saves nothing and leaves no gap in receipt or batch numbers', async () => {
    const col = await loginAs('COL');
    const producer = ctx.producers['PRD-00417'];
    const field = ctx.fields['PRD-00417'][0];
    const body = { producerId: producer.id, fieldId: field.id, grossKg: 30, tareKg: 1 };

    const first = (await col.post('/api/v1/collections').send(body)).body;
    const counts = async () => [await prisma.collection.count(), await prisma.greenLeafBatch.count(), await prisma.auditLog.count()];
    const before = await counts();

    // A field id that does not exist: the counters are incremented, then the Collection insert hits the FK.
    const req = { user: { id: ctx.users.COL.id }, ip: 'test' };
    const err = await failure(() => recordCollection({ req, producer, field: { id: randomUUID(), code: 'F-X' }, grossKg: 30, tareKg: 1 }));
    expect(err.code).toBe('P2003');
    expect(mapDatabaseError(err)).toMatchObject({ status: 400, fields: [{ field: 'fieldId' }] });
    expect(await counts()).toEqual(before);

    const next = (await col.post('/api/v1/collections').send(body)).body;
    expect(seqOf(next.receiptNo)).toBe(seqOf(first.receiptNo) + 1);
    expect(seqOf(next.batchCode)).toBe(seqOf(first.batchCode) + 1);
  });
});

describe('CHECK constraints', () => {
  const collectionData = (extra = {}) => ({
    receiptNo: `RC-9${Math.floor(Math.random() * 1e6)}`,
    producerId: ctx.producers['PRD-00417'].id,
    fieldId: ctx.fields['PRD-00417'][0].id,
    collectorId: ctx.users.COL.id,
    purchasePriceId: ctx.price.id,
    pricePerKg: 245,
    grossKg: 100,
    tareKg: 4,
    netKg: 96,
    ...extra,
  });

  it('accepts a consistent row', async () => {
    const c = await prisma.collection.create({ data: collectionData() });
    expect(Number(c.netKg)).toBe(96);
  });

  it('refuses net_kg that is not gross - tare, and maps it to a 400 field error', async () => {
    const err = await failure(() => prisma.collection.create({ data: collectionData({ netKg: 95 }) }));
    const api = mapDatabaseError(err);
    expect(api.status).toBe(400);
    expect(api.code).toBe('VALIDATION_ERROR');
    expect(api.fields[0].field).toBe('netKg');
  });

  it.each([
    ['gross above 10000 kg', { grossKg: 10001, tareKg: 1, netKg: 10000 }, 'grossKg'],
    ['gross 0', { grossKg: 0, tareKg: 0, netKg: 0 }, 'grossKg'],
    ['negative tare', { grossKg: 10, tareKg: -1, netKg: 11 }, 'tareKg'],
    ['tare equal to gross', { grossKg: 10, tareKg: 10, netKg: 0 }, 'tareKg'],
  ])('refuses %s', async (_, weights, field) => {
    const err = await failure(() => prisma.collection.create({ data: collectionData(weights) }));
    expect(mapDatabaseError(err)).toMatchObject({ status: 400, fields: [{ field }] });
  });

  it('refuses a field area of 0', async () => {
    const err = await failure(() => prisma.field.create({
      data: { code: 'F-00417-Z', producerId: ctx.producers['PRD-00417'].id, areaHa: 0 },
    }));
    expect(mapDatabaseError(err)).toMatchObject({ status: 400, fields: [{ field: 'areaHa' }] });
  });

  it('refuses an ORG_MEMBER producer without an organisation', async () => {
    const err = await failure(() => prisma.producer.create({
      data: {
        code: 'PRD-99999', type: 'ORG_MEMBER', fullName: 'No Org', nicOrRegNo: '999999999V',
        centreId: ctx.centres.GAL.id, registeredById: ctx.users.COL.id,
      },
    }));
    expect(mapDatabaseError(err)).toMatchObject({ status: 400, fields: [{ field: 'orgId' }] });
  });

  it('refuses a user without roles', async () => {
    const err = await failure(() => prisma.user.create({
      data: { fullName: 'Nobody', email: 'noroles@smarttea.lk', passwordHash: 'x', roles: [] },
    }));
    expect(mapDatabaseError(err)).toMatchObject({ status: 400, fields: [{ field: 'roles' }] });
  });

  it('maps a duplicate (unique constraint) to the same 409 as before', async () => {
    const err = await failure(() => prisma.user.create({
      data: { fullName: 'Dup', email: 'admin@smarttea.lk', passwordHash: 'x', roles: ['ADM'] },
    }));
    expect(mapDatabaseError(err)).toMatchObject({
      status: 409, code: 'CONFLICT', message: 'A record with this email already exists', fields: [{ field: 'email' }],
    });
  });
});

describe('audit_log is append-only (database trigger)', () => {
  it('refuses UPDATE and DELETE, through Prisma and raw SQL', async () => {
    const entry = await prisma.auditLog.findFirst();
    const total = await prisma.auditLog.count();
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'TAMPERED' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`UPDATE "audit_log" SET "action" = 'TAMPERED'`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM "audit_log"`).rejects.toThrow(/append-only/);
    expect(await prisma.auditLog.count()).toBe(total);
    expect((await prisma.auditLog.findUnique({ where: { id: entry.id } })).action).toBe(entry.action);
  });

  it('still accepts new entries', async () => {
    const before = await prisma.auditLog.count();
    await prisma.auditLog.create({ data: { action: 'TEST', entityType: 'Test' } });
    expect(await prisma.auditLog.count()).toBe(before + 1);
  });
});

describe('schema and app stay in sync', () => {
  it('JS enum lists match the Postgres enums', () => {
    expect(Object.values($Enums.Role)).toEqual(ROLE_CODES);
    expect(Object.values($Enums.UserStatus)).toEqual(enums.USER_STATUSES);
    expect(Object.values($Enums.ProducerType)).toEqual(enums.PRODUCER_TYPES);
    expect(Object.values($Enums.VerificationStatus)).toEqual(enums.VERIFICATION_STATUSES);
    expect(Object.values($Enums.FieldStatus)).toEqual(enums.FIELD_STATUSES);
    expect(Object.values($Enums.BatchStatus)).toEqual(enums.BATCH_STATUSES);
    expect(Object.values($Enums.PriceType)).toEqual(enums.PRICE_TYPES);
    expect(Object.values($Enums.PriceStatus)).toEqual(enums.PRICE_STATUSES);
  });

  it('passwordHash is never returned unless asked for', async () => {
    const u = await prisma.user.findFirst();
    expect(u).not.toHaveProperty('passwordHash');
    const withHash = await prisma.user.findFirst({ omit: { passwordHash: false } });
    expect(withHash.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});
