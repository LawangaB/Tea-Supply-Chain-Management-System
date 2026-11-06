import Collection from '../models/Collection.js';
import Producer from '../models/Producer.js';
import { CollectionCentre, ProducerOrg } from '../models/reference.js';
import { todayRange, localParts } from '../rules/codes.js';
import { ROLES } from '../rules/permissions.js';

const r3 = (n) => Math.round((n ?? 0) * 1000) / 1000;

/** MGT landing page: today's totals (Sri Lanka time). */
export async function today(req, res) {
  const { start, end } = todayRange();
  const match = { collectedAt: { $gte: start, $lt: end } };
  const [[totals], byCentre, pendingProducers, verifiedProducers, recent] = await Promise.all([
    Collection.aggregate([{ $match: match }, { $group: { _id: null, netKg: { $sum: '$netKg' }, count: { $sum: 1 }, producers: { $addToSet: '$producer' } } }]),
    Collection.aggregate([
      { $match: match },
      { $group: { _id: '$centre', netKg: { $sum: '$netKg' }, count: { $sum: 1 } } },
      { $lookup: { from: 'collectioncentres', localField: '_id', foreignField: '_id', as: 'centre' } },
      { $unwind: { path: '$centre', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, centre: '$centre.name', netKg: 1, count: 1 } },
      { $sort: { netKg: -1 } },
    ]),
    Producer.countDocuments({ verificationStatus: 'PENDING' }),
    Producer.countDocuments({ verificationStatus: 'VERIFIED' }),
    Collection.find(match).sort({ collectedAt: -1 }).limit(5)
      .populate([{ path: 'producer', select: 'code fullName' }, { path: 'batch', select: 'batchCode' }]).lean(),
  ]);
  const { year, month, day } = localParts();
  res.json({
    date: `${year}-${month}-${day}`,
    totalNetKg: r3(totals?.netKg),
    collectionsCount: totals?.count ?? 0,
    producersSupplied: totals?.producers?.length ?? 0,
    pendingProducers,
    verifiedProducers,
    byCentre: byCentre.map((b) => ({ ...b, netKg: r3(b.netKg) })),
    recent: recent.map((c) => ({
      id: String(c._id), receiptNo: c.receiptNo, batchCode: c.batch?.batchCode,
      producer: c.producer && { code: c.producer.code, fullName: c.producer.fullName },
      netKg: c.netKg, collectedAt: c.collectedAt,
    })),
  });
}

/** Reference data for forms (any signed-in user). */
export async function lookups(req, res) {
  const [centres, orgs] = await Promise.all([
    CollectionCentre.find().sort({ name: 1 }).lean(),
    ProducerOrg.find().sort({ name: 1 }).lean(),
  ]);
  res.json({ centres, orgs, roles: Object.entries(ROLES).map(([code, name]) => ({ code, name })) });
}
