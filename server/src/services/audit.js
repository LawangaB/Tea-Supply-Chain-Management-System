import AuditLog from '../models/AuditLog.js';

/**
 * Append an audit entry. Pass `session` to make it part of a transaction.
 * Audit failures outside a transaction are logged but never break the request.
 */
export async function audit({ req, user, action, entityType, entityId, oldValue, newValue, reason, session }) {
  const entry = {
    user: user ?? req?.user?.id ?? null,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    reason: reason ?? null,
    ip: req?.ip ?? null,
  };
  if (session) {
    await AuditLog.create([entry], { session });
    return;
  }
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}
