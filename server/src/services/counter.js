/**
 * Atomically increments and returns the next number for `key` ("RC", "PRD", "GL-2026-11", "F-00417").
 *
 * One statement: it creates the counter at 1 if it doesn't exist, otherwise increments it, and returns
 * the new value. The row stays locked until the surrounding transaction ends, so concurrent callers
 * queue on it and can never get the same number. Because it runs inside the caller's transaction (`tx`),
 * a rollback also rolls back the increment, so numbers have no gaps.
 */
export async function nextSeq(key, tx) {
  if (!tx) throw new Error('nextSeq must run inside a transaction');
  const [row] = await tx.$queryRaw`
    INSERT INTO "counter" ("id", "seq") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "seq" = "counter"."seq" + 1
    RETURNING "seq"`;
  return Number(row.seq);
}
