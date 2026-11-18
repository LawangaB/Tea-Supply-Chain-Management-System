import { prisma } from '../config/db.js';
import { ApiError, zodFields } from '../middleware/errors.js';
import { assertOwnProducer, ownProducerIds } from '../middleware/auth.js';
import { can } from '../rules/permissions.js';
import { weightErrors, roundKg } from '../rules/netWeight.js';
import { todayRange } from '../rules/codes.js';
import { createCollectionSchema } from '../validation/schemas.js';
import { recordCollection } from '../services/collection.service.js';
import { num } from '../serializers.js';
import { assertUuid, icontains, isUuid, pageParams } from './util.js';

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const INCLUDE = {
  producer: { select: { id: true, code: true, fullName: true, type: true } },
  field: { select: { id: true, code: true, division: true } },
  centre: { select: { code: true, name: true } },
  collector: { select: { id: true, fullName: true } },
  batch: { select: { batchCode: true, status: true } },
};

/** Shape used by POST /collections and GET /collections/:id/receipt. */
function toReceipt(c) {
  return {
    id: c.id,
    receiptNo: c.receiptNo,
    batchCode: c.batch?.batchCode,
    batchStatus: c.batch?.status,
    producer: c.producer && { id: c.producer.id, code: c.producer.code, fullName: c.producer.fullName, type: c.producer.type },
    field: c.field && { id: c.field.id, code: c.field.code, division: c.field.division },
    centre: c.centre && { code: c.centre.code, name: c.centre.name },
    collector: c.collector && { id: c.collector.id, fullName: c.collector.fullName },
    collectedAt: c.collectedAt,
    grossKg: num(c.grossKg),
    tareKg: num(c.tareKg),
    netKg: num(c.netKg),
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

  const producer = await prisma.producer.findUnique({ where: { id: data.producerId } });
  if (!producer) throw ApiError.badRequest('Validation failed', [{ field: 'producerId', message: 'Producer not found' }]);
  if (producer.verificationStatus !== 'VERIFIED') {
    throw new ApiError(409, 'PRODUCER_NOT_VERIFIED',
      `Producer ${producer.code} is ${producer.verificationStatus.toLowerCase()} — only verified producers can supply leaf`,
      [{ field: 'producerId', message: 'Producer is not verified' }]);
  }
  const field = await prisma.field.findFirst({ where: { id: data.fieldId, producerId: producer.id } });
  if (!field) throw ApiError.badRequest('Validation failed', [{ field: 'fieldId', message: 'Field does not belong to this producer' }]);
  if (field.status !== 'ACTIVE') throw ApiError.badRequest('Validation failed', [{ field: 'fieldId', message: 'Field is inactive' }]);

  const { collection } = await recordCollection({
    req, producer, field, grossKg: req.body.grossKg, tareKg: req.body.tareKg, collectedAt: data.collectedAt,
  });
  const full = await prisma.collection.findUnique({ where: { id: collection.id }, include: INCLUDE });
  res.status(201).json(toReceipt(full));
}

export async function listCollections(req, res) {
  const { q, producerId, from, to, today, mine } = req.query;
  const { page, limit, skip } = pageParams(req.query);
  const where = {};

  if (req.scope === 'own') where.producerId = { in: await ownProducerIds(req) };
  if (producerId) {
    if (!isUuid(String(producerId))) throw ApiError.badRequest('Invalid producerId', [{ field: 'producerId', message: 'Invalid id' }]);
    if (req.scope === 'own') await assertOwnProducer(req, producerId);
    where.producerId = String(producerId);
  }
  if (mine === 'true') where.collectorId = req.user.id;
  const range = {};
  if (today === 'true') Object.assign(range, { gte: todayRange().start, lt: todayRange().end });
  if (from && !Number.isNaN(Date.parse(from))) range.gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.lte = new Date(to);
  if (Object.keys(range).length) where.collectedAt = range;
  if (q) {
    const term = icontains(String(q).trim());
    where.OR = [{ receiptNo: term }, { producer: { OR: [{ code: term }, { fullName: term }] } }];
  }

  const [docs, total, sums] = await Promise.all([
    prisma.collection.findMany({ where, include: INCLUDE, orderBy: { collectedAt: 'desc' }, skip, take: limit }),
    prisma.collection.count({ where }),
    prisma.collection.aggregate({ where, _sum: { netKg: true } }),
  ]);
  const showBatch = can(req.user.roles, 'batch:read');
  const items = docs.map((c) => {
    const r = toReceipt(c);
    if (!showBatch) { delete r.batchCode; delete r.batchStatus; }
    return r;
  });
  res.json({ items, total, page, limit, totalNetKg: roundKg(Number(sums._sum.netKg ?? 0)) });
}

export async function getReceipt(req, res) {
  assertUuid(req.params.id, 'Collection');
  const c = await prisma.collection.findUnique({ where: { id: req.params.id }, include: INCLUDE });
  if (!c) throw ApiError.notFound('Collection not found');
  await assertOwnProducer(req, c.producer.id);
  res.json(toReceipt(c));
}
