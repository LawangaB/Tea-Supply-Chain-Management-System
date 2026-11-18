import { prisma } from '../config/db.js';
import { todayRange, localParts } from '../rules/codes.js';
import { ROLES } from '../rules/permissions.js';
import { centreOut, num, orgOut } from '../serializers.js';

const r3 = (n) => Math.round(Number(n ?? 0) * 1000) / 1000;

/** MGT landing page: today's totals (Sri Lanka time). */
export async function today(req, res) {
  const { start, end } = todayRange();
  const where = { collectedAt: { gte: start, lt: end } };
  const [totals, perProducer, perCentre, centres, pendingProducers, verifiedProducers, recent] = await Promise.all([
    prisma.collection.aggregate({ where, _sum: { netKg: true }, _count: { _all: true } }),
    prisma.collection.groupBy({ by: ['producerId'], where }),
    prisma.collection.groupBy({ by: ['centreId'], where, _sum: { netKg: true }, _count: { _all: true } }),
    prisma.collectionCentre.findMany({ select: { id: true, name: true } }),
    prisma.producer.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.producer.count({ where: { verificationStatus: 'VERIFIED' } }),
    prisma.collection.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      take: 5,
      include: { producer: { select: { code: true, fullName: true } }, batch: { select: { batchCode: true } } },
    }),
  ]);
  const centreName = new Map(centres.map((c) => [c.id, c.name]));
  const byCentre = perCentre
    .map((g) => {
      const name = centreName.get(g.centreId);
      return { netKg: r3(g._sum.netKg), count: g._count._all, ...(name !== undefined ? { centre: name } : {}) };
    })
    .sort((a, b) => b.netKg - a.netKg);

  const { year, month, day } = localParts();
  res.json({
    date: `${year}-${month}-${day}`,
    totalNetKg: r3(totals._sum.netKg),
    collectionsCount: totals._count._all,
    producersSupplied: perProducer.length,
    pendingProducers,
    verifiedProducers,
    byCentre,
    recent: recent.map((c) => ({
      id: c.id, receiptNo: c.receiptNo, batchCode: c.batch?.batchCode,
      producer: c.producer && { code: c.producer.code, fullName: c.producer.fullName },
      netKg: num(c.netKg), collectedAt: c.collectedAt,
    })),
  });
}

/** Reference data for forms (any signed-in user). */
export async function lookups(req, res) {
  const [centres, orgs] = await Promise.all([
    prisma.collectionCentre.findMany({ orderBy: { name: 'asc' } }),
    prisma.producerOrg.findMany({ orderBy: { name: 'asc' } }),
  ]);
  res.json({
    centres: centres.map(centreOut),
    orgs: orgs.map(orgOut),
    roles: Object.entries(ROLES).map(([code, name]) => ({ code, name })),
  });
}
