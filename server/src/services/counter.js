import { Counter } from '../models/reference.js';

/**
 * Make sure a counter document exists. Call this BEFORE starting a transaction for
 * counters that receive concurrent traffic (receipts, monthly batch numbers):
 * two transactions both upserting a missing counter would hit a duplicate-key error,
 * which is not retried automatically.
 */
export async function ensureCounter(key, initial = 0) {
  // Plain reads never block on other transactions' locks; only upsert when the counter is new.
  if (await Counter.exists({ _id: key })) return;
  try {
    await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: initial } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err; // another request created it first — fine
  }
}

/**
 * Atomically increments and returns the next number for `key`.
 * findOneAndUpdate + $inc is a single atomic document update in MongoDB, so two
 * concurrent callers can never receive the same value. Pass a session to make the
 * increment part of a transaction (it is then rolled back if the transaction aborts,
 * so numbers have no gaps).
 */
export async function nextSeq(key, session = null) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  return doc.seq;
}
