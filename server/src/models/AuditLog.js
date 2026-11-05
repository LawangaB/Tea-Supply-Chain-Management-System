import mongoose from 'mongoose';

/** Append-only audit trail. There are no update/delete routes, and the model refuses updates. */
const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true }, // e.g. LOGIN_SUCCESS, PRODUCER_VERIFIED
  entityType: { type: String, required: true },
  entityId: { type: String, default: null },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: null },
  ip: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditSchema.index({ entityType: 1, entityId: 1 });

const refuse = () => { throw new Error('AuditLog is append-only'); };
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace']) {
  auditSchema.pre(op, refuse);
}

export default mongoose.model('AuditLog', auditSchema);
