import { prisma } from '../config/db.js';
import { ApiError } from '../middleware/errors.js';
import { assertOwnProducer } from '../middleware/auth.js';
import { can } from '../rules/permissions.js';
import { formatProducerCode } from '../rules/codes.js';
import { roundKg } from '../rules/netWeight.js';
import { PRODUCER_TYPES, VERIFICATION_STATUSES } from '../rules/enums.js';
import { nextSeq } from '../services/counter.js';
import { audit } from '../services/audit.js';
import { fieldOut, producerOut } from '../serializers.js';
import { assertUuid, icontains, isUuid, pageParams } from './util.js';

const PERSON = { select: { id: true, fullName: true } };
/** Relations shown on the full producer record (Mongo-era populate). */
const FULL = {
  centre: { select: { id: true, code: true, name: true, district: true } },
  org: { select: { id: true, regNo: true, name: true } },
  registeredBy: PERSON,
  verifiedBy: PERSON,
};
/** Relations shown in lists and on create. */
const BRIEF = { centre: FULL.centre, org: FULL.org };

async function loadProducer(req) {
  assertUuid(req.params.id, 'Producer');
  const producer = await prisma.producer.findUnique({ where: { id: req.params.id } });
  if (!producer) throw ApiError.notFound('Producer not found');
  await assertOwnProducer(req, producer.id);
  return producer;
}

/** Field input from the API (gps: {lat,lng}) to columns; area rounded to 3 dp as before. */
const fieldData = ({ gps, areaHa, ...f }) => ({
  ...f, areaHa: roundKg(areaHa), gpsLat: gps?.lat ?? null, gpsLng: gps?.lng ?? null,
});

/** Next field code for a producer: F-00417-A, F-00417-B, ... (must run inside a transaction). */
async function nextFieldCode(producer, tx) {
  const digits = producer.code.replace('PRD-', '');
  const n = await nextSeq(`F-${digits}`, tx);
  let letters = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) letters = String.fromCharCode(65 + ((x - 1) % 26)) + letters;
  return `F-${digits}-${letters}`;
}

export async function listProducers(req, res) {
  const { q, status, type, centre } = req.query;
  const { page, limit, skip } = pageParams(req.query);
  const where = {};
  if (req.scope === 'own') where.userId = req.user.id;
  if (q) where.OR = ['code', 'fullName', 'nicOrRegNo', 'phone'].map((k) => ({ [k]: icontains(String(q).trim()) }));
  const st = status && String(status).toUpperCase();
  const ty = type && String(type).toUpperCase();
  // Unknown enum values match nothing (as before) instead of failing the enum cast.
  if ((st && !VERIFICATION_STATUSES.includes(st)) || (ty && !PRODUCER_TYPES.includes(ty))) {
    return res.json({ items: [], total: 0, page, limit });
  }
  if (st) where.verificationStatus = st;
  if (ty) where.type = ty;
  if (centre && isUuid(String(centre))) where.centreId = String(centre);

  const [items, total] = await Promise.all([
    prisma.producer.findMany({ where, include: BRIEF, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.producer.count({ where }),
  ]);
  res.json({ items: items.map(producerOut), total, page, limit });
}

export async function getProducer(req, res) {
  const { id } = await loadProducer(req);
  const [producer, fields] = await Promise.all([
    prisma.producer.findUnique({ where: { id }, include: FULL }),
    prisma.field.findMany({ where: { producerId: id }, orderBy: { code: 'asc' } }),
  ]);
  let collections = null;
  if (can(req.user.roles, 'collection:read')) {
    const agg = await prisma.collection.aggregate({
      where: { producerId: id }, _count: { _all: true }, _sum: { netKg: true }, _max: { collectedAt: true },
    });
    collections = {
      count: agg._count._all,
      totalNetKg: roundKg(Number(agg._sum.netKg ?? 0)),
      lastCollectedAt: agg._max.collectedAt ?? null,
    };
  }
  res.json({ ...producerOut(producer), fields: fields.map(fieldOut), collections });
}

export async function createProducer(req, res) {
  const { centreId, orgId, fields, ...data } = req.body;
  const fieldErrors = [];
  const [centre, org, dup] = await Promise.all([
    prisma.collectionCentre.findUnique({ where: { id: centreId }, select: { id: true } }),
    orgId ? prisma.producerOrg.findUnique({ where: { id: orgId }, select: { id: true } }) : true,
    prisma.producer.findUnique({ where: { nicOrRegNo: data.nicOrRegNo }, select: { id: true } }),
  ]);
  if (!centre) fieldErrors.push({ field: 'centreId', message: 'Collection centre not found' });
  if (!org) fieldErrors.push({ field: 'orgId', message: 'Producer organisation not found' });
  if (dup) fieldErrors.push({ field: 'nicOrRegNo', message: 'A producer with this NIC / registration no. is already registered' });
  if (fieldErrors.length) {
    const isDup = fieldErrors.some((f) => f.field === 'nicOrRegNo');
    throw isDup && fieldErrors.length === 1
      ? ApiError.conflict('Producer already registered', fieldErrors)
      : ApiError.badRequest('Validation failed', fieldErrors);
  }

  const producer = await prisma.$transaction(async (tx) => {
    const code = formatProducerCode(await nextSeq('PRD', tx));
    const p = await tx.producer.create({
      data: { ...data, code, centreId, orgId: orgId || null, verificationStatus: 'PENDING', registeredById: req.user.id },
    });
    for (const f of fields) {
      await tx.field.create({ data: { ...fieldData(f), producerId: p.id, code: await nextFieldCode(p, tx) } });
    }
    await audit({ req, action: 'PRODUCER_REGISTERED', entityType: 'Producer', entityId: p.id,
      newValue: { code, fullName: p.fullName, type: p.type, fields: fields.length }, tx });
    return tx.producer.findUnique({ where: { id: p.id }, include: BRIEF });
  });
  res.status(201).json(producerOut(producer));
}

export async function verifyProducer(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus === 'VERIFIED') throw ApiError.conflict('Producer is already verified');
  const old = producer.verificationStatus;
  const updated = await prisma.producer.update({
    where: { id: producer.id },
    data: { verificationStatus: 'VERIFIED', verifiedById: req.user.id, verifiedAt: new Date(), rejectionReason: null },
    include: FULL,
  });
  await audit({ req, action: 'PRODUCER_VERIFIED', entityType: 'Producer', entityId: producer.id,
    oldValue: { verificationStatus: old }, newValue: { verificationStatus: 'VERIFIED' } });
  res.json(producerOut(updated));
}

export async function rejectProducer(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus !== 'PENDING') {
    throw ApiError.conflict(`Only pending producers can be rejected (current status: ${producer.verificationStatus})`);
  }
  const updated = await prisma.producer.update({
    where: { id: producer.id },
    data: { verificationStatus: 'REJECTED', verifiedById: req.user.id, verifiedAt: new Date(), rejectionReason: req.body.reason },
    include: FULL,
  });
  await audit({ req, action: 'PRODUCER_REJECTED', entityType: 'Producer', entityId: producer.id,
    oldValue: { verificationStatus: 'PENDING' }, newValue: { verificationStatus: 'REJECTED' }, reason: req.body.reason });
  res.json(producerOut(updated));
}

export async function listFields(req, res) {
  const producer = await loadProducer(req);
  const items = await prisma.field.findMany({ where: { producerId: producer.id }, orderBy: { code: 'asc' } });
  res.json({ items: items.map(fieldOut), total: items.length });
}

export async function createField(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus === 'REJECTED') throw ApiError.conflict('Cannot add fields to a rejected producer');
  // Code + insert in one transaction, so a failed insert does not use up a field letter.
  const field = await prisma.$transaction(async (tx) => tx.field.create({
    data: { ...fieldData(req.body), producerId: producer.id, code: await nextFieldCode(producer, tx) },
  }));
  await audit({ req, action: 'FIELD_CREATED', entityType: 'Field', entityId: field.id,
    newValue: { code: field.code, producer: producer.code, areaHa: Number(field.areaHa) } });
  res.status(201).json(fieldOut(field));
}
