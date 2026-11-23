import { prisma } from '../config/db.js';

/**
 * Append an audit entry. Pass `tx` (a Prisma transaction client) to make it part of a transaction.
 * Audit failures outside a transaction are logged but never break the request.
 * The audit_log table is append-only (a database trigger refuses UPDATE and DELETE).
 */
export async function audit({ req, user, action, entityType, entityId, oldValue, newValue, reason, tx }) {
  const data = {
    userId: user ?? req?.user?.id ?? null,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    oldValue: oldValue ?? undefined, // undefined → SQL NULL
    newValue: newValue ?? undefined,
    reason: reason ?? null,
    ip: req?.ip ?? null,
  };
  if (tx) {
    await tx.auditLog.create({ data });
    return;
  }
  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}
