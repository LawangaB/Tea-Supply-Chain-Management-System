import { describe, it, expect } from 'vitest';
import { prisma } from '../config/db.js';
import { useSeededDb, loginAs } from './helpers.js';

const ctx = useSeededDb();
let nic = 300000000000;

/** Registers a fresh PENDING producer (as COL) with one field. */
async function pendingProducer(name = 'Pending Producer') {
  const res = await (await loginAs('COL')).post('/api/v1/producers').send({
    type: 'SMALLHOLDER', fullName: name, nicOrRegNo: String(nic++), centreId: ctx.centres.GAL.id,
    fields: [{ division: 'Home', areaHa: 0.5, variety: 'TRI 2025' }],
  });
  expect(res.status).toBe(201);
  expect(res.body.verificationStatus).toBe('PENDING');
  const field = await prisma.field.findFirst({ where: { producerId: res.body._id } });
  return { id: res.body._id, fieldId: field.id };
}

const auditsFor = (id) => prisma.auditLog.findMany({ where: { entityId: id, action: { in: ['PRODUCER_VERIFIED', 'PRODUCER_REJECTED'] } } });

describe('US-015 verify and approve a producer (ESPTSCMS-80)', () => {
  it('Scenario: approve - a pending producer becomes Verified and the action is audited', async () => {
    const p = await pendingProducer('To Approve');
    const mgt = await loginAs('MGT');
    const res = await mgt.post(`/api/v1/producers/${p.id}/verify`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verificationStatus: 'VERIFIED', rejectionReason: null });
    expect(res.body.verifiedBy.fullName).toBe('Ruwan Senanayake');
    expect(res.body.verifiedAt).toBeTruthy();

    const [log] = await auditsFor(p.id);
    expect(log).toMatchObject({
      action: 'PRODUCER_VERIFIED', entityType: 'Producer', userId: ctx.users.MGT.id,
      oldValue: { verificationStatus: 'PENDING' }, newValue: { verificationStatus: 'VERIFIED' },
    });
  });

  it('Scenario: reject with reason - status becomes Rejected and the officer can see the reason', async () => {
    const p = await pendingProducer('To Reject');
    const mgt = await loginAs('MGT');
    const missing = await mgt.post(`/api/v1/producers/${p.id}/reject`).send({ reason: ' ' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields[0].field).toBe('reason');

    const res = await mgt.post(`/api/v1/producers/${p.id}/reject`).send({ reason: 'NIC does not match the land deed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verificationStatus: 'REJECTED', rejectionReason: 'NIC does not match the land deed' });

    // The Leaf Collection Officer who registered the producer sees the decision and the reason.
    const seen = await (await loginAs('COL')).get(`/api/v1/producers/${p.id}`);
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({ verificationStatus: 'REJECTED', rejectionReason: 'NIC does not match the land deed' });
    expect(seen.body.verifiedBy.fullName).toBe('Ruwan Senanayake');

    const [log] = await auditsFor(p.id);
    expect(log).toMatchObject({ action: 'PRODUCER_REJECTED', reason: 'NIC does not match the land deed' });
  });

  it('Scenario: access denied for a Leaf Collection Officer - and no data is changed', async () => {
    const p = await pendingProducer('COL cannot verify');
    const before = await prisma.producer.findUnique({ where: { id: p.id } });
    const col = await loginAs('COL');

    for (const [path, body] of [['verify', {}], ['reject', { reason: 'Trying to reject' }]]) {
      const res = await col.post(`/api/v1/producers/${p.id}/${path}`).send(body);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    const after = await prisma.producer.findUnique({ where: { id: p.id } });
    expect(after).toEqual(before);
    expect(await auditsFor(p.id)).toHaveLength(0);
  });

  it('only Management can verify or reject (every other role gets 403)', async () => {
    const p = await pendingProducer('Others denied');
    for (const role of ['ADM', 'FRM', 'COL', 'FAC', 'QO', 'WH', 'BUY', 'TRN']) {
      const agent = await loginAs(role);
      expect((await agent.post(`/api/v1/producers/${p.id}/verify`)).status).toBe(403);
      expect((await agent.post(`/api/v1/producers/${p.id}/reject`).send({ reason: 'No access' })).status).toBe(403);
    }
    expect((await prisma.producer.findUnique({ where: { id: p.id } })).verificationStatus).toBe('PENDING');
  });

  it('only pending producers can be decided: no re-approving a rejected one, no rejecting a verified one', async () => {
    const mgt = await loginAs('MGT');
    const rejected = await pendingProducer('Rejected stays rejected');
    await mgt.post(`/api/v1/producers/${rejected.id}/reject`).send({ reason: 'Duplicate registration' });
    const reApprove = await mgt.post(`/api/v1/producers/${rejected.id}/verify`);
    expect(reApprove.status).toBe(409);
    expect(reApprove.body.error.message).toMatch(/current status: REJECTED/);

    const verified = await pendingProducer('Verified stays verified');
    await mgt.post(`/api/v1/producers/${verified.id}/verify`);
    expect((await mgt.post(`/api/v1/producers/${verified.id}/verify`)).body.error.message).toBe('Producer is already verified');
    expect((await mgt.post(`/api/v1/producers/${verified.id}/reject`).send({ reason: 'Changed my mind' })).status).toBe(409);

    expect(await auditsFor(rejected.id)).toHaveLength(1);
    expect(await auditsFor(verified.id)).toHaveLength(1);
  });

  it('simultaneous approve and reject: exactly one wins and the audit log matches the data', async () => {
    const p = await pendingProducer('Race');
    const [a, b] = await Promise.all([loginAs('MGT'), loginAs('MGT')]);
    const results = await Promise.all([
      a.post(`/api/v1/producers/${p.id}/verify`),
      b.post(`/api/v1/producers/${p.id}/reject`).send({ reason: 'Raced' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const final = (await prisma.producer.findUnique({ where: { id: p.id } })).verificationStatus;
    const logs = await auditsFor(p.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].newValue.verificationStatus).toBe(final);
  });

  it('only verified producers can supply leaf (pending and rejected are refused)', async () => {
    const col = await loginAs('COL');
    const mgt = await loginAs('MGT');
    const p = await pendingProducer('Collection gate');
    const weigh = () => col.post('/api/v1/collections').send({ producerId: p.id, fieldId: p.fieldId, grossKg: 30, tareKg: 1 });

    const pending = await weigh();
    expect(pending.status).toBe(409);
    expect(pending.body.error).toMatchObject({ code: 'PRODUCER_NOT_VERIFIED', fields: [{ field: 'producerId', message: 'Producer is not verified' }] });

    await mgt.post(`/api/v1/producers/${p.id}/verify`);
    expect((await weigh()).status).toBe(201);

    const r = await pendingProducer('Rejected gate');
    await mgt.post(`/api/v1/producers/${r.id}/reject`).send({ reason: 'Not a tea grower' });
    const rejected = await col.post('/api/v1/collections').send({ producerId: r.id, fieldId: r.fieldId, grossKg: 30, tareKg: 1 });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('PRODUCER_NOT_VERIFIED');
  });
});
