import mongoose from 'mongoose';
import { PRODUCER_CODE_RE } from '../rules/codes.js';

const { ObjectId } = mongoose.Schema.Types;

export const PRODUCER_TYPES = ['SMALLHOLDER', 'ESTATE', 'ORG_MEMBER'];
export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const producerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, match: PRODUCER_CODE_RE },
  type: { type: String, enum: PRODUCER_TYPES, required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  nicOrRegNo: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  phone: { type: String, trim: true, maxlength: 20 },
  address: { type: String, trim: true, maxlength: 300 },
  centre: { type: ObjectId, ref: 'CollectionCentre', required: true },
  org: { type: ObjectId, ref: 'ProducerOrg', default: null },
  user: { type: ObjectId, ref: 'User', default: null }, // FRM login linked to this producer
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING' },
  rejectionReason: { type: String, trim: true, maxlength: 300 },
  registeredBy: { type: ObjectId, ref: 'User', required: true },
  verifiedBy: { type: ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

producerSchema.index({ user: 1 });
producerSchema.index({ verificationStatus: 1 });
producerSchema.path('org').validate(function validateOrg(v) {
  return this.type !== 'ORG_MEMBER' || !!v;
}, 'Producer organisation is required for organisation members');

export default mongoose.model('Producer', producerSchema);
