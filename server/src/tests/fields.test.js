import { describe, it, expect } from 'vitest';
import { prisma } from '../config/db.js';
import { useSeededDb, loginAs } from './helpers.js';

const ctx = useSeededDb();
const own = () => ctx.producers['PRD-00417']; // linked to the demo farmer (farmer@smarttea.lk)
const other = () => ctx.producers['PRD-00419'];

describe('US-016 manage fields (ESPTSCMS-18)', () => {
  it('Scenario: a farmer adds a field with location, area and variety -> saved under their profile', async () => {
    const frm = await loginAs('FRM');
    const res = await frm.post(`/api/v1/producers/${own().id}/fields`)
      .send({ division: 'Lower terrace', areaHa: 0.5, variety: 'TRI 2026', gps: { lat: 7.0263, lng: 80.6873 } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      producer: own().id, division: 'Lower terrace', areaHa: 0.5, variety: 'TRI 2026',
      gps: { lat: 7.0263, lng: 80.6873 }, status: 'ACTIVE',
    });
    expect(res.body.code).toMatch(/^F-00417-[A-Z]+$/);

    const mine = await frm.get('/api/v1/fields');
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((f) => f.code)).toContain(res.body.code);
    expect(await prisma.auditLog.findFirst({ where: { action: 'FIELD_CREATED', entityId: res.body._id } })).toBeTruthy();
  });

  it('a farmer updates their own field and the change is audited', async () => {
    const frm = await loginAs('FRM');
    const field = ctx.fields['PRD-00417'][0];
    const res = await frm.patch(`/api/v1/fields/${field.id}`).send({ areaHa: 0.8456, variety: 'TRI 4042' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ areaHa: 0.846, variety: 'TRI 4042', division: 'Home garden' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'FIELD_UPDATED', entityId: field.id } });
    expect(log.oldValue).toMatchObject({ areaHa: 0.8, variety: 'TRI 2025' });
    expect(log.newValue).toMatchObject({ areaHa: 0.846, variety: 'TRI 4042' });
  });

  it('sets and clears the GPS location; validates area and coordinates', async () => {
    const mgt = await loginAs('MGT');
    const field = ctx.fields['PRD-00417'][1];
    expect((await mgt.patch(`/api/v1/fields/${field.id}`).send({ gps: { lat: 7.1, lng: 80.6 } })).body.gps)
      .toEqual({ lat: 7.1, lng: 80.6 });
    const cleared = await mgt.patch(`/api/v1/fields/${field.id}`).send({ gps: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.gps).toBeUndefined();

    const bad = await mgt.patch(`/api/v1/fields/${field.id}`).send({ areaHa: 0, gps: { lat: 95, lng: 80 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.map((f) => f.field)).toEqual(expect.arrayContaining(['areaHa', 'gps.lat']));
    expect((await mgt.patch(`/api/v1/fields/${field.id}`).send({})).status).toBe(400);
  });

  it('deactivates a field instead of deleting it; inactive fields cannot be collected from', async () => {
    const frm = await loginAs('FRM');
    const created = await frm.post(`/api/v1/producers/${own().id}/fields`).send({ division: 'Old block', areaHa: 0.2 });
    const res = await frm.patch(`/api/v1/fields/${created.body._id}`).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(await prisma.auditLog.findFirst({ where: { action: 'FIELD_DEACTIVATED', entityId: created.body._id } })).toBeTruthy();

    const col = await loginAs('COL');
    const c = await col.post('/api/v1/collections').send({ producerId: own().id, fieldId: created.body._id, grossKg: 20, tareKg: 1 });
    expect(c.status).toBe(400);
    expect(c.body.error.fields[0]).toEqual({ field: 'fieldId', message: 'Field is inactive' });

    const active = await frm.get('/api/v1/fields?status=ACTIVE');
    expect(active.body.items.map((f) => f._id)).not.toContain(created.body._id);
  });

  it("Scenario: own fields only - a farmer cannot see or edit another farmer's fields", async () => {
    const frm = await loginAs('FRM');
    const otherField = ctx.fields['PRD-00419'][0];

    const search = await frm.get(`/api/v1/fields?q=${encodeURIComponent(otherField.code)}`);
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(0);
    const byProducer = await frm.get(`/api/v1/fields?producerId=${other().id}`);
    expect(byProducer.body.total).toBe(0);
    const all = await frm.get('/api/v1/fields?limit=100');
    expect(all.body.items.every((f) => f.producer.code === 'PRD-00417')).toBe(true);

    expect((await frm.get(`/api/v1/fields/${otherField.id}`)).status).toBe(403);
    expect((await frm.get(`/api/v1/producers/${other().id}/fields`)).status).toBe(403);
    expect((await frm.patch(`/api/v1/fields/${otherField.id}`).send({ variety: 'Hacked' })).status).toBe(403);
    expect((await frm.post(`/api/v1/producers/${other().id}/fields`).send({ areaHa: 1 })).status).toBe(403);
    expect((await prisma.field.findUnique({ where: { id: otherField.id } })).variety).not.toBe('Hacked');
  });

  it("Scenario: a collection officer can view a farmer's fields but not edit them", async () => {
    const col = await loginAs('COL');
    const list = await col.get(`/api/v1/fields?producerId=${own().id}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThan(0);
    expect(list.body.items[0].producer).toMatchObject({ code: 'PRD-00417' });
    expect((await col.get(`/api/v1/producers/${own().id}/fields`)).status).toBe(200);

    const field = ctx.fields['PRD-00417'][0];
    const res = await col.patch(`/api/v1/fields/${field.id}`).send({ variety: 'Changed by COL' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('searches fields by code, division, variety and producer name', async () => {
    const mgt = await loginAs('MGT');
    expect((await mgt.get('/api/v1/fields?q=upper division')).body.items[0].code).toMatch(/^F-00419-/);
    expect((await mgt.get('/api/v1/fields?q=seedling')).body.total).toBeGreaterThan(0);
    expect((await mgt.get('/api/v1/fields?q=sunil')).body.items.every((f) => f.producer.code === 'PRD-00417')).toBe(true);
    expect((await mgt.get('/api/v1/fields?status=BOGUS')).status).toBe(400);
  });
});
