import mongoose from 'mongoose';
import Producer from '../models/Producer.js';
import Field from '../models/Field.js';
import Collection from '../models/Collection.js';
import { CollectionCentre, ProducerOrg } from '../models/reference.js';
import { ApiError } from '../middleware/errors.js';
import { assertOwnProducer } from '../middleware/auth.js';
import { can } from '../rules/permissions.js';
import { formatProducerCode } from '../rules/codes.js';
import { ensureCounter, nextSeq } from '../services/counter.js';
import { audit } from '../services/audit.js';
import { assertObjectId, escapeRegex, pageParams } from './util.js';

const POPULATE = [
  { path: 'centre', select: 'code name district' },
  { path: 'org', select: 'regNo name' },
  { path: 'registeredBy', select: 'fullName' },
  { path: 'verifiedBy', select: 'fullName' },
];

async function loadProducer(req) {
  assertObjectId(req.params.id, 'Producer');
  const producer = await Producer.findById(req.params.id);
  if (!producer) throw ApiError.notFound('Producer not found');
  await assertOwnProducer(req, producer._id);
  return producer;
}

/** Next field code for a producer: F-00417-A, F-00417-B, ... */
async function nextFieldCode(producer, session) {
  const digits = producer.code.replace('PRD-', '');
  const n = await nextSeq(`F-${digits}`, session);
  let letters = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) letters = String.fromCharCode(65 + ((x - 1) % 26)) + letters;
  return `F-${digits}-${letters}`;
}

export async function listProducers(req, res) {
  const { q, status, type, centre } = req.query;
  const { page, limit, skip } = pageParams(req.query);
  const filter = {};
  if (req.scope === 'own') filter.user = req.user.id;
  if (q) {
    const re = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ code: re }, { fullName: re }, { nicOrRegNo: re }, { phone: re }];
  }
  if (status) filter.verificationStatus = String(status).toUpperCase();
  if (type) filter.type = String(type).toUpperCase();
  if (centre && mongoose.isValidObjectId(centre)) filter.centre = centre;

  const [items, total] = await Promise.all([
    Producer.find(filter).populate(POPULATE.slice(0, 2)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Producer.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}

export async function getProducer(req, res) {
  const producer = await loadProducer(req);
  await producer.populate(POPULATE);
  const fields = await Field.find({ producer: producer._id }).sort({ code: 1 }).lean();
  let collections = null;
  if (can(req.user.roles, 'collection:read')) {
    const [agg] = await Collection.aggregate([
      { $match: { producer: producer._id } },
      { $group: { _id: null, count: { $sum: 1 }, totalNetKg: { $sum: '$netKg' }, last: { $max: '$collectedAt' } } },
    ]);
    collections = { count: agg?.count ?? 0, totalNetKg: Math.round((agg?.totalNetKg ?? 0) * 1000) / 1000, lastCollectedAt: agg?.last ?? null };
  }
  res.json({ ...producer.toObject(), fields, collections });
}

export async function createProducer(req, res) {
  const { centreId, orgId, fields, ...data } = req.body;
  const fieldErrors = [];
  if (!(await CollectionCentre.exists({ _id: centreId }))) fieldErrors.push({ field: 'centreId', message: 'Collection centre not found' });
  if (orgId && !(await ProducerOrg.exists({ _id: orgId }))) fieldErrors.push({ field: 'orgId', message: 'Producer organisation not found' });
  if (await Producer.exists({ nicOrRegNo: data.nicOrRegNo })) {
    fieldErrors.push({ field: 'nicOrRegNo', message: 'A producer with this NIC / registration no. is already registered' });
  }
  if (fieldErrors.length) {
    const dup = fieldErrors.some((f) => f.field === 'nicOrRegNo');
    throw dup && fieldErrors.length === 1
      ? ApiError.conflict('Producer already registered', fieldErrors)
      : ApiError.badRequest('Validation failed', fieldErrors);
  }

  let producer;
  await ensureCounter('PRD');
  await mongoose.connection.transaction(async (session) => {
    const code = formatProducerCode(await nextSeq('PRD', session));
    [producer] = await Producer.create([{
      ...data, code, centre: centreId, org: orgId || null,
      verificationStatus: 'PENDING', registeredBy: req.user.id,
    }], { session });
    for (const f of fields) {
      await Field.create([{ ...f, producer: producer._id, code: await nextFieldCode(producer, session) }], { session });
    }
    await audit({ req, action: 'PRODUCER_REGISTERED', entityType: 'Producer', entityId: producer._id,
      newValue: { code, fullName: producer.fullName, type: producer.type, fields: fields.length }, session });
  });
  await producer.populate(POPULATE.slice(0, 2));
  res.status(201).json(producer);
}

export async function verifyProducer(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus === 'VERIFIED') throw ApiError.conflict('Producer is already verified');
  const old = producer.verificationStatus;
  Object.assign(producer, { verificationStatus: 'VERIFIED', verifiedBy: req.user.id, verifiedAt: new Date(), rejectionReason: undefined });
  await producer.save();
  await audit({ req, action: 'PRODUCER_VERIFIED', entityType: 'Producer', entityId: producer._id,
    oldValue: { verificationStatus: old }, newValue: { verificationStatus: 'VERIFIED' } });
  await producer.populate(POPULATE);
  res.json(producer);
}

export async function rejectProducer(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus !== 'PENDING') {
    throw ApiError.conflict(`Only pending producers can be rejected (current status: ${producer.verificationStatus})`);
  }
  Object.assign(producer, { verificationStatus: 'REJECTED', verifiedBy: req.user.id, verifiedAt: new Date(), rejectionReason: req.body.reason });
  await producer.save();
  await audit({ req, action: 'PRODUCER_REJECTED', entityType: 'Producer', entityId: producer._id,
    oldValue: { verificationStatus: 'PENDING' }, newValue: { verificationStatus: 'REJECTED' }, reason: req.body.reason });
  await producer.populate(POPULATE);
  res.json(producer);
}

export async function listFields(req, res) {
  const producer = await loadProducer(req);
  const items = await Field.find({ producer: producer._id }).sort({ code: 1 }).lean();
  res.json({ items, total: items.length });
}

export async function createField(req, res) {
  const producer = await loadProducer(req);
  if (producer.verificationStatus === 'REJECTED') throw ApiError.conflict('Cannot add fields to a rejected producer');
  await ensureCounter(`F-${producer.code.replace('PRD-', '')}`);
  const field = await Field.create({ ...req.body, producer: producer._id, code: await nextFieldCode(producer) });
  await audit({ req, action: 'FIELD_CREATED', entityType: 'Field', entityId: field._id,
    newValue: { code: field.code, producer: producer.code, areaHa: field.areaHa } });
  res.status(201).json(field);
}
