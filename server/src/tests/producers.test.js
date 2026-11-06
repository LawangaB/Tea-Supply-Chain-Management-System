import { describe, it, expect } from 'vitest';
import Producer from '../models/Producer.js';
import AuditLog from '../models/AuditLog.js';
import { PRODUCER_CODE_RE } from '../rules/codes.js';
import { useSeededDb, loginAs } from './helpers.js';

const ctx = useSeededDb();
const newProducer = (extra = {}) => ({
  type: 'SMALLHOLDER', fullName: 'P. Anura Dissanayake', nicOrRegNo: '198012345678', phone: '0712223334',
  address: 'Galaha', centreId: String(ctx.centres.GAL._id),
  fields: [{ division: 'Home', areaHa: 0.75, variety: 'TRI 2025' }], ...extra,
});

describe('producer registry (ESPTSCMS-17)', () => {
  it('COL registers a producer -> PENDING with a PRD code and field codes', async () => {
    const col = await loginAs('COL');
    const res = await col.post('/api/v1/producers').send(newProducer());
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(PRODUCER_CODE_RE);
    expect(res.body.code).toBe('PRD-00423');
    expect(res.body.verificationStatus).toBe('PENDING');
    const fields = await col.get(`/api/v1/producers/${res.body._id}/fields`);
    expect(fields.body.items.map((f) => f.code)).toEqual(['F-00423-A']);
    expect(await AuditLog.exists({ action: 'PRODUCER_REGISTERED' })).toBeTruthy();
  });

  it('rejects a duplicate NIC with 409', async () => {
    const res = await (await loginAs('MGT')).post('/api/v1/producers').send(newProducer());
    expect(res.status).toBe(409);
    expect(res.body.error.fields[0].field).toBe('nicOrRegNo');
  });

  it('validates the body with field errors', async () => {
    const res = await (await loginAs('COL')).post('/api/v1/producers').send({ type: 'ORG_MEMBER', fullName: 'X', nicOrRegNo: '12345', centreId: 'bad' });
    expect(res.status).toBe(400);
    const f = res.body.error.fields.map((e) => e.field);
    expect(f).toEqual(expect.arrayContaining(['fullName', 'centreId']));
  });

  it('requires an organisation for ORG_MEMBER and validates NIC format', async () => {
    const res = await (await loginAs('COL')).post('/api/v1/producers')
      .send(newProducer({ type: 'ORG_MEMBER', nicOrRegNo: '12345' }));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((e) => e.field)).toEqual(expect.arrayContaining(['nicOrRegNo', 'orgId']));
  });

  it('lists and searches producers by name, code and NIC', async () => {
    const mgt = await loginAs('MGT');
    expect((await mgt.get('/api/v1/producers?q=sunil')).body.items[0].code).toBe('PRD-00417');
    expect((await mgt.get('/api/v1/producers?q=PRD-00419')).body.items[0].fullName).toMatch(/Delta/);
    expect((await mgt.get('/api/v1/producers?q=826543210')).body.items[0].code).toBe('PRD-00418');
    const pending = await mgt.get('/api/v1/producers?status=PENDING');
    expect(pending.body.items.every((p) => p.verificationStatus === 'PENDING')).toBe(true);
    expect((await mgt.get('/api/v1/producers?q=.*')).body.total).toBe(0); // regex is escaped
  });

  it('FRM sees only their own producer record', async () => {
    const frm = await loginAs('FRM');
    const list = await frm.get('/api/v1/producers');
    expect(list.body.items.map((p) => p.code)).toEqual(['PRD-00417']);
    expect((await frm.get(`/api/v1/producers/${ctx.producers['PRD-00417']._id}`)).status).toBe(200);
    expect((await frm.get(`/api/v1/producers/${ctx.producers['PRD-00419']._id}`)).status).toBe(403);
    expect((await frm.post('/api/v1/producers').send(newProducer({ nicOrRegNo: '199912345678' }))).status).toBe(403);
  });

  it('producer profile includes fields and collection totals', async () => {
    const res = await (await loginAs('MGT')).get(`/api/v1/producers/${ctx.producers['PRD-00417']._id}`);
    expect(res.body.fields.map((f) => f.code)).toEqual(['F-00417-A', 'F-00417-B']);
    expect(res.body.collections.count).toBeGreaterThan(0);
    expect(res.body.centre.name).toBe('Galaha');
  });
});

describe('verification (only MGT)', () => {
  it('only MGT can verify; verified producers can then be collected from', async () => {
    const pending = ctx.producers['PRD-00422'];
    for (const role of ['ADM', 'COL', 'FRM', 'FAC', 'QO', 'BUY']) {
      expect((await (await loginAs(role)).post(`/api/v1/producers/${pending._id}/verify`)).status).toBe(403);
    }
    const mgt = await loginAs('MGT');
    const res = await mgt.post(`/api/v1/producers/${pending._id}/verify`);
    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe('VERIFIED');
    expect(res.body.verifiedBy.fullName).toBe('Ruwan Senanayake');
    expect((await mgt.post(`/api/v1/producers/${pending._id}/verify`)).status).toBe(409);

    const col = await loginAs('COL');
    const c = await col.post('/api/v1/collections').send({
      producerId: String(pending._id), fieldId: String(ctx.fields['PRD-00422'][0]._id), grossKg: 40, tareKg: 2,
    });
    expect(c.status).toBe(201);
    expect(await AuditLog.exists({ action: 'PRODUCER_VERIFIED', entityId: String(pending._id) })).toBeTruthy();
  });

  it('MGT rejects a pending producer with a reason', async () => {
    const col = await loginAs('COL');
    const created = await col.post('/api/v1/producers').send(newProducer({ nicOrRegNo: '200112345678', fullName: 'To Reject' }));
    const mgt = await loginAs('MGT');
    expect((await mgt.post(`/api/v1/producers/${created.body._id}/reject`).send({})).status).toBe(400);
    const res = await mgt.post(`/api/v1/producers/${created.body._id}/reject`).send({ reason: 'NIC does not match land deed' });
    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe('REJECTED');
    expect((await Producer.findById(created.body._id)).rejectionReason).toBe('NIC does not match land deed');
  });

  it('MGT and COL can add fields; codes continue the sequence', async () => {
    const res = await (await loginAs('COL')).post(`/api/v1/producers/${ctx.producers['PRD-00417']._id}/fields`)
      .send({ division: 'New block', areaHa: 0.3456, variety: 'TRI 2025' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('F-00417-C');
    expect(res.body.areaHa).toBe(0.346);
  });
});
