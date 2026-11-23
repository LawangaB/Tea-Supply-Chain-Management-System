import { prisma } from '../config/db.js';
import { computeNetKg, roundKg } from '../rules/netWeight.js';
import { batchCounterKey, formatBatchCode, formatReceiptNo } from '../rules/codes.js';
import { nextSeq } from './counter.js';
import { audit } from './audit.js';
import { ApiError } from '../middleware/errors.js';

/** Generous limits: under load, requests queue for a pool connection and for the counter row lock. */
export const TX_OPTIONS = { maxWait: 15000, timeout: 20000 };

/** The APPROVED green-leaf purchase price in force at `at`. */
export async function currentPurchasePrice(at = new Date(), db = prisma) {
  return db.priceVersion.findFirst({
    where: { priceType: 'PURCHASE_GL', status: 'APPROVED', effectiveFrom: { lte: at } },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
  });
}

/**
 * Records a green-leaf collection (US-020/021/022).
 * In ONE transaction: next receipt no. + next batch no. (atomic counters), the Collection,
 * its GreenLeafBatch and the audit entry. If anything fails, nothing is saved and the
 * counters roll back too, so numbers stay gap-free. Concurrent requests queue on the counter
 * row lock (services/counter.js) and can never get the same receipt or batch number; the unique
 * constraints on receipt_no and batch_code back this up.
 */
export async function recordCollection({ req, producer, field, grossKg, tareKg, collectedAt }) {
  computeNetKg(grossKg, tareKg); // validates (throws WeightError with field messages)
  // Stored at gram precision (numeric(10,3)); compute net from the stored values so it always
  // satisfies the database CHECK net_kg = round(gross_kg - tare_kg, 3).
  const gross = roundKg(grossKg);
  const tare = roundKg(tareKg);
  const netKg = roundKg(gross - tare);
  const at = collectedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const price = await currentPurchasePrice(at, tx);
    if (!price) throw ApiError.conflict('No approved green-leaf purchase price is in effect');

    // Always take the receipt counter first, then the batch counter (same lock order → no deadlocks).
    const receiptNo = formatReceiptNo(await nextSeq('RC', tx));
    const batchCode = formatBatchCode(at, await nextSeq(batchCounterKey(at), tx));

    const collection = await tx.collection.create({
      data: {
        receiptNo,
        producerId: producer.id,
        fieldId: field.id,
        centreId: producer.centreId,
        collectorId: req.user.id,
        collectedAt: at,
        grossKg: gross,
        tareKg: tare,
        netKg,
        purchasePriceId: price.id,
        pricePerKg: price.pricePerKg,
      },
    });
    const batch = await tx.greenLeafBatch.create({
      data: { batchCode, collectionId: collection.id, netKg, status: 'IN_TRANSIT' },
    });

    await audit({ req, action: 'COLLECTION_CREATED', entityType: 'Collection', entityId: collection.id,
      newValue: { receiptNo, batchCode, producer: producer.code, field: field.code, grossKg: gross, tareKg: tare, netKg }, tx });
    return { collection, batch };
  }, TX_OPTIONS);
}
