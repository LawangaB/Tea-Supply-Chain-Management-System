import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../config/db.js';
import { BATCH_CODE_RE, RECEIPT_NO_RE, batchCounterKey } from '../rules/codes.js';
import { useSeededDb, loginAs } from './helpers.js';

const ctx = useSeededDb();
let col;
const p417 = () => ctx.producers['PRD-00417'];
const fieldB = () => ctx.fields['PRD-00417'][1]; // F-00417-B
const body = (extra = {}) => ({ producerId: p417().id, fieldId: fieldB().id, grossKg: 438.0, tareKg: 26.0, ...extra });

beforeAll(async () => { col = await loginAs('COL'); });

describe('POST /collections (ESPTSCMS-20 / 84 / 83)', () => {
  it('COL records 438.0 gross / 26.0 tare for PRD-00417 -> net 412.0 kg with batch ID and receipt', async () => {
    const res = await col.post('/api/v1/collections').send(body());
    expect(res.status).toBe(201);
    expect(res.body.netKg).toBe(412);
    expect(res.body.grossKg).toBe(438);
    expect(res.body.tareKg).toBe(26);
    expect(res.body.batchCode).toMatch(BATCH_CODE_RE);
    expect(res.body.batchCode.startsWith(batchCounterKey(new Date()))).toBe(true);
    expect(res.body.receiptNo).toMatch(RECEIPT_NO_RE);
    expect(res.body.producer.code).toBe('PRD-00417');
    expect(res.body.field.code).toBe('F-00417-B');
    expect(res.body.collector.fullName).toBe('Pradeep Kumara');

    const saved = await prisma.collection.findUnique({ where: { id: res.body.id } });
    expect(Number(saved.pricePerKg)).toBe(245);
    expect(saved.purchasePriceId).toBe(ctx.price.id);
    const batch = await prisma.greenLeafBatch.findUnique({ where: { batchCode: res.body.batchCode } });
    expect(Number(batch.netKg)).toBe(412);
    expect(batch.status).toBe('IN_TRANSIT');
    expect(batch.collectionId).toBe(res.body.id);
    expect(await prisma.auditLog.findFirst({ where: { action: 'COLLECTION_CREATED', entityId: res.body.id } })).toBeTruthy();
  });

  it('ignores a netKg sent by the client', async () => {
    const res = await col.post('/api/v1/collections').send(body({ grossKg: 100, tareKg: 4, netKg: 9999 }));
    expect(res.status).toBe(201);
    expect(res.body.netKg).toBe(96);
  });

  it.each([
    ['gross 0', { grossKg: 0 }, 'grossKg'],
    ['negative tare', { tareKg: -1 }, 'tareKg'],
    ['tare >= gross', { grossKg: 20, tareKg: 20 }, 'tareKg'],
    ['text weight', { grossKg: 'heavy' }, 'grossKg'],
    ['numeric string', { tareKg: '26' }, 'tareKg'],
  ])('rejects %s with a 400 field error', async (_, extra, field) => {
    const before = await prisma.collection.count();
    const res = await col.post('/api/v1/collections').send(body(extra));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f) => f.field)).toContain(field);
    expect(await prisma.collection.count()).toBe(before);
  });

  it('reports all field errors at once', async () => {
    const res = await col.post('/api/v1/collections').send({ grossKg: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f) => f.field)).toEqual(expect.arrayContaining(['producerId', 'fieldId', 'grossKg', 'tareKg']));
  });

  it('refuses a PENDING producer (409)', async () => {
    const pending = ctx.producers['PRD-00422'];
    const res = await col.post('/api/v1/collections').send({
      producerId: pending.id, fieldId: ctx.fields['PRD-00422'][0].id, grossKg: 50, tareKg: 2,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCER_NOT_VERIFIED');
  });

  it("refuses a field that belongs to another producer", async () => {
    const res = await col.post('/api/v1/collections').send(body({ fieldId: ctx.fields['PRD-00418'][0].id }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].field).toBe('fieldId');
  });

  it('refuses a collection time in the future', async () => {
    const res = await col.post('/api/v1/collections').send(body({ collectedAt: new Date(Date.now() + 3600000).toISOString() }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].field).toBe('collectedAt');
  });

  it('generates unique, gap-free batch IDs and receipt numbers under 20 parallel requests', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => col.post('/api/v1/collections').send(body({ grossKg: 100 + i, tareKg: 5 }))));
    for (const r of results) expect(r.status, JSON.stringify(r.body)).toBe(201);
    const codes = results.map((r) => r.body.batchCode);
    const receipts = results.map((r) => r.body.receiptNo);
    expect(new Set(codes).size).toBe(20);
    expect(new Set(receipts).size).toBe(20);
    for (const c of codes) expect(c).toMatch(BATCH_CODE_RE);
    // Sequential within the month: no gaps among the 20.
    const seqs = codes.map((c) => Number(c.split('-')[3])).sort((a, b) => a - b);
    expect(seqs[19] - seqs[0]).toBe(19);
    // ... and the same for receipt numbers.
    const rcs = receipts.map((r) => Number(r.slice(3))).sort((a, b) => a - b);
    expect(rcs[19] - rcs[0]).toBe(19);
    // Every collection has exactly one batch.
    expect(await prisma.greenLeafBatch.count()).toBe(await prisma.collection.count());
  });

  it('the database refuses duplicate batch codes (unique index)', async () => {
    const existing = await prisma.greenLeafBatch.findFirst();
    await expect(prisma.greenLeafBatch.create({
      data: { batchCode: existing.batchCode, collectionId: existing.collectionId, netKg: 1 },
    })).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('receipts and listing', () => {
  it('COL and MGT can open a receipt; FRM can open their own but not others', async () => {
    const own = await prisma.collection.findFirst({ where: { producerId: p417().id } });
    const other = await prisma.collection.findFirst({ where: { producerId: ctx.producers['PRD-00419'].id } });
    const r = await col.get(`/api/v1/collections/${own.id}/receipt`);
    expect(r.status).toBe(200);
    expect(r.body.batchCode).toMatch(BATCH_CODE_RE);
    expect((await (await loginAs('MGT')).get(`/api/v1/collections/${other.id}/receipt`)).status).toBe(200);

    const frm = await loginAs('FRM');
    expect((await frm.get(`/api/v1/collections/${own.id}/receipt`)).status).toBe(200);
    expect((await frm.get(`/api/v1/collections/${other.id}/receipt`)).status).toBe(403);
  });

  it('FRM sees only their own collections', async () => {
    const frm = await loginAs('FRM');
    const res = await frm.get('/api/v1/collections?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(await prisma.collection.count({ where: { producerId: p417().id } }));
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const c of res.body.items) expect(c.producer.code).toBe('PRD-00417');
    // FRM may not see batch IDs in the list (matrix: View Green-Leaf Batch IDs = "-")
    expect(res.body.items[0]).not.toHaveProperty('batchCode');
    // ... and cannot ask for someone else's
    const other = await frm.get(`/api/v1/collections?producerId=${ctx.producers['PRD-00419'].id}`);
    expect(other.status).toBe(403);
  });

  it('FAC sees all collections with batch IDs', async () => {
    const res = await (await loginAs('FAC')).get('/api/v1/collections?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(await prisma.collection.count());
    expect(res.body.items[0].batchCode).toMatch(BATCH_CODE_RE);
  });

  it('BUY gets 403 on GET and POST /collections', async () => {
    const buy = await loginAs('BUY');
    expect((await buy.get('/api/v1/collections')).status).toBe(403);
    expect((await buy.post('/api/v1/collections').send(body())).status).toBe(403);
  });
});

describe('GET /dashboard/today (MGT)', () => {
  it("returns today's totals that include new collections", async () => {
    const mgt = await loginAs('MGT');
    const before = (await mgt.get('/api/v1/dashboard/today')).body;
    await col.post('/api/v1/collections').send(body({ grossKg: 50.5, tareKg: 0.5 }));
    const after = (await mgt.get('/api/v1/dashboard/today')).body;
    expect(after.collectionsCount).toBe(before.collectionsCount + 1);
    expect(after.totalNetKg).toBeCloseTo(before.totalNetKg + 50, 3);
    expect(after.pendingProducers).toBe(1);
    expect(after.recent[0].producer.code).toBe('PRD-00417');
  });
});
