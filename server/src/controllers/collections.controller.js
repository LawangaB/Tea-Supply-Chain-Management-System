import mongoose from 'mongoose';
import Collection from '../models/Collection.js';
import Producer from '../models/Producer.js';
import Field from '../models/Field.js';
import { ApiError, zodFields } from '../middleware/errors.js';
import { assertOwnProducer, ownProducerIds } from '../middleware/auth.js';
import { can } from '../rules/permissions.js';
import { weightErrors } from '../rules/netWeight.js';
import { todayRange } from '../rules/codes.js';
import { createCollectionSchema } from '../validation/schemas.js';
import { recordCollection } from '../services/collection.service.js';
import { assertObjectId, escapeRegex, pageParams } from './util.js';

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const POPULATE = [
  { path: 'producer', select: 'code fullName type' },
  { path: 'field', select: 'code division' },
  { path: 'centre', select: 'code name' },
  { path: 'collector', select: 'fullName' },
  { path: 'batch', select: 'batchCode status' },
];

/** Shape used by POST /collections and GET /collections/:id/receipt. */
function toReceipt(c) {
  return {
    id: String(c._id),
    receiptNo: c.receiptNo,
    batchCode: c.batch?.batchCode,
    batchStatus: c.batch?.status,
    producer: c.producer && { id: String(c.producer._id), code: c.producer.code, fullName: c.producer.fullName, type: c.producer.type },
    field: c.field && { id: String(c.field._id), code: c.field.code, division: c.field.division },
    centre: c.centre && { code: c.centre.code, name: c.centre.name },
    collector: c.collector && { id: String(c.collector._id), fullName: c.collector.fullName },
    collectedAt: c.collectedAt,
    grossKg: c.grossKg,
    tareKg: c.tareKg,
    netKg: c.netKg,
  };
}

export async function createCollection(req, res) {
  // Validate ids with zod and weights with the business rule, and report all field errors together.
  const parsed = createCollectionSchema.safeParse(req.body ?? {});
  const fields = parsed.success ? [] : zodFields(parsed.error);
  fields.push(...weightErrors(req.body?.grossKg, req.body?.tareKg));
  const data = parsed.success ? parsed.data : {};
  if (data.collectedAt && data.collectedAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    fields.push({ field: 'collectedAt', message: 'Collection time cannot be in the future' });
  }
  if (fields.length) throw ApiError.badRequest('Validation failed', fields);

  const producer = await Producer.findById(data.producerId);
  if (!producer) throw ApiError.badRequest('Validation failed', [{ field: 'producerId', message: 'Producer not found' }]);
  if (producer.verificationStatus !== 'VERIFIED') {
    throw new ApiError(409, 'PRODUCER_NOT_VERIFIED',
      `Producer ${producer.code} is ${producer.verificationStatus.toLowerCase()} — only verified producers can supply leaf`,
      [{ field: 'producerId', message: 'Producer is not verified' }]);
  }
  const field = await Field.findOne({ _id: data.fieldId, producer: producer._id });
  if (!field) throw ApiError.badRequest('Validation failed', [{ field: 'fieldId', message: 'Field does not belong to this producer' }]);
  if (field.status !== 'ACTIVE') throw ApiError.badRequest('Validation failed', [{ field: 'fieldId', message: 'Field is inactive' }]);

  const { collection } = await recordCollection({
    req, producer, field, grossKg: req.body.grossKg, tareKg: req.body.tareKg, collectedAt: data.collectedAt,
  });
  await collection.populate(POPULATE);
  res.status(201).json(toReceipt(collection));
}

export async function listCollections(req, res) {
  const { q, producerId, from, to, today, mine } = req.query;
  const { page, limit, skip } = pageParams(req.query);
  const filter = {};

  if (req.scope === 'own') filter.producer = { $in: (await ownProducerIds(req)).map((id) => new mongoose.Types.ObjectId(id)) };
  if (producerId) {
    if (!mongoose.isValidObjectId(producerId)) throw ApiError.badRequest('Invalid producerId', [{ field: 'producerId', message: 'Invalid id' }]);
    if (req.scope === 'own') await assertOwnProducer(req, producerId);
    filter.producer = new mongoose.Types.ObjectId(String(producerId));
  }
  if (mine === 'true') filter.collector = new mongoose.Types.ObjectId(req.user.id);
  const range = {};
  if (today === 'true') Object.assign(range, { $gte: todayRange().start, $lt: todayRange().end });
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(to);
  if (Object.keys(range).length) filter.collectedAt = range;
  if (q) {
    const re = new RegExp(escapeRegex(String(q).trim()), 'i');
    const producers = await Producer.find({ $or: [{ code: re }, { fullName: re }] }).select('_id').lean();
    filter.$or = [{ receiptNo: re }, { producer: { $in: producers.map((p) => p._id) } }];
  }

  const [docs, total, sums] = await Promise.all([
    Collection.find(filter).populate(POPULATE).sort({ collectedAt: -1 }).skip(skip).limit(limit).lean(),
    Collection.countDocuments(filter),
    Collection.aggregate([{ $match: filter }, { $group: { _id: null, netKg: { $sum: '$netKg' } } }]),
  ]);
  const showBatch = can(req.user.roles, 'batch:read');
  const items = docs.map((c) => {
    const r = toReceipt(c);
    if (!showBatch) { delete r.batchCode; delete r.batchStatus; }
    return r;
  });
  res.json({ items, total, page, limit, totalNetKg: Math.round((sums[0]?.netKg ?? 0) * 1000) / 1000 });
}

export async function getReceipt(req, res) {
  assertObjectId(req.params.id, 'Collection');
  const c = await Collection.findById(req.params.id).populate(POPULATE).lean();
  if (!c) throw ApiError.notFound('Collection not found');
  await assertOwnProducer(req, c.producer._id);
  res.json(toReceipt(c));
}
