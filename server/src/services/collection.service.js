import mongoose from 'mongoose';
import Collection from '../models/Collection.js';
import GreenLeafBatch from '../models/GreenLeafBatch.js';
import { PriceVersion } from '../models/reference.js';
import { computeNetKg } from '../rules/netWeight.js';
import { batchCounterKey, formatBatchCode, formatReceiptNo } from '../rules/codes.js';
import { ensureCounter, nextSeq } from './counter.js';
import { audit } from './audit.js';
import { ApiError } from '../middleware/errors.js';

/** The APPROVED green-leaf purchase price in force at `at`. */
export async function currentPurchasePrice(at = new Date(), session = null) {
  return PriceVersion.findOne({ priceType: 'PURCHASE_GL', status: 'APPROVED', effectiveFrom: { $lte: at } })
    .sort({ effectiveFrom: -1, version: -1 })
    .session(session);
}

/**
 * Records a green-leaf collection (US-020/021/022).
 * In ONE transaction: next receipt no. + next batch no. (atomic counters), the Collection,
 * its GreenLeafBatch and the audit entry. If anything fails, nothing is saved and the
 * counters roll back too. Write conflicts between concurrent requests are retried by
 * connection.transaction() (TransientTransactionError).
 */
export async function recordCollection({ req, producer, field, grossKg, tareKg, collectedAt }) {
  const netKg = computeNetKg(grossKg, tareKg); // server-side only
  const at = collectedAt ?? new Date();
  const batchKey = batchCounterKey(at);
  await Promise.all([ensureCounter('RC'), ensureCounter(batchKey)]);

  let collection;
  let batch;
  await mongoose.connection.transaction(async (session) => {
    const price = await currentPurchasePrice(at, session);
    if (!price) throw ApiError.conflict('No approved green-leaf purchase price is in effect');

    const receiptNo = formatReceiptNo(await nextSeq('RC', session));
    const batchCode = formatBatchCode(at, await nextSeq(batchKey, session));
    const collectionId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    [collection] = await Collection.create([{
      _id: collectionId,
      receiptNo,
      producer: producer._id,
      field: field._id,
      centre: producer.centre,
      collector: req.user.id,
      collectedAt: at,
      grossKg,
      tareKg,
      netKg,
      purchasePrice: price._id,
      pricePerKg: price.pricePerKg,
      batch: batchId,
    }], { session });

    [batch] = await GreenLeafBatch.create([{
      _id: batchId, batchCode, leafCollection: collectionId, netKg, status: 'IN_TRANSIT',
    }], { session });

    await audit({ req, action: 'COLLECTION_CREATED', entityType: 'Collection', entityId: collectionId,
      newValue: { receiptNo, batchCode, producer: producer.code, field: field.code, grossKg, tareKg, netKg }, session });
  });
  return { collection, batch };
}
