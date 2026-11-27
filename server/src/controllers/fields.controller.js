// Fields – US-016 (ESPTSCMS-18): search fields and update / deactivate a field.
// Adding a field stays under the producer (POST /producers/:id/fields, producers.controller.js).
import { prisma } from '../config/db.js';
import { ApiError } from '../middleware/errors.js';
import { assertOwnProducer } from '../middleware/auth.js';
import { roundKg } from '../rules/netWeight.js';
import { audit } from '../services/audit.js';
import { fieldOut } from '../serializers.js';
import { listFieldsQuerySchema } from '../validation/schemas.js';
import { assertUuid, icontains } from './util.js';

const PRODUCER_BRIEF = { select: { id: true, code: true, fullName: true, verificationStatus: true } };

/** Field row plus a small producer reference, so a search result says whose field it is. */
const withProducer = (f) => ({
  ...fieldOut(f),
  producer: f.producer
    ? { _id: f.producer.id, code: f.producer.code, fullName: f.producer.fullName }
    : f.producerId,
});

/** GET /fields?q=&producerId=&status= – FRM only ever sees fields of their own producer record. */
export async function listFields(req, res) {
  const { q, producerId, status, page, limit } = listFieldsQuerySchema.parse(req.query);
  const where = {};
  if (req.scope === 'own') where.producer = { userId: req.user.id };
  if (producerId) where.producerId = producerId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { code: icontains(q) }, { division: icontains(q) }, { variety: icontains(q) },
      { producer: { code: icontains(q) } }, { producer: { fullName: icontains(q) } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.field.findMany({
      where, include: { producer: PRODUCER_BRIEF }, orderBy: { code: 'asc' }, skip: (page - 1) * limit, take: limit,
    }),
    prisma.field.count({ where }),
  ]);
  res.json({ items: items.map(withProducer), total, page, limit });
}

/** GET /fields/:id */
export async function getField(req, res) {
  assertUuid(req.params.id, 'Field');
  const field = await prisma.field.findUnique({ where: { id: req.params.id }, include: { producer: PRODUCER_BRIEF } });
  if (!field) throw ApiError.notFound('Field not found');
  await assertOwnProducer(req, field.producerId);
  res.json(withProducer(field));
}

/** PATCH /fields/:id – edit location, area, variety, or deactivate / reactivate. Fields are never deleted. */
export async function updateField(req, res) {
  assertUuid(req.params.id, 'Field');
  const field = await prisma.field.findUnique({ where: { id: req.params.id }, include: { producer: PRODUCER_BRIEF } });
  if (!field) throw ApiError.notFound('Field not found');
  await assertOwnProducer(req, field.producerId);
  if (field.producer.verificationStatus === 'REJECTED') {
    throw ApiError.conflict('Cannot change fields of a rejected producer');
  }

  const { gps, areaHa, ...rest } = req.body;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (areaHa !== undefined) data.areaHa = roundKg(areaHa);
  if (gps !== undefined) {
    data.gpsLat = gps?.lat ?? null;
    data.gpsLng = gps?.lng ?? null;
  }

  // Audit only what actually changed.
  const before = fieldOut(field);
  const updated = await prisma.$transaction(async (tx) => {
    const f = await tx.field.update({ where: { id: field.id }, data, include: { producer: PRODUCER_BRIEF } });
    const after = fieldOut(f);
    const keys = ['division', 'areaHa', 'variety', 'gps', 'status']
      .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
    if (keys.length) {
      const pick = (o) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
      await audit({
        req, tx, entityType: 'Field', entityId: f.id,
        action: keys.length === 1 && keys[0] === 'status'
          ? (after.status === 'INACTIVE' ? 'FIELD_DEACTIVATED' : 'FIELD_REACTIVATED')
          : 'FIELD_UPDATED',
        oldValue: { code: f.code, ...pick(before) }, newValue: { code: f.code, ...pick(after) },
      });
    }
    return f;
  });
  res.json(withProducer(updated));
}
