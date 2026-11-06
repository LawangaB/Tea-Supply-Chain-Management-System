import mongoose from 'mongoose';
import { BATCH_CODE_RE } from '../rules/codes.js';

export const BATCH_STATUSES = ['IN_TRANSIT', 'RECEIVED', 'ACCEPTED', 'ADJUSTED', 'REJECTED', 'CONSUMED'];

const batchSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true, match: BATCH_CODE_RE },
  // ERD field "collection" — renamed because 'collection' is a reserved Mongoose path
  leafCollection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true, unique: true },
  netKg: { type: Number, required: true, min: 0 },
  acceptedKg: { type: Number, default: null, min: 0 },
  status: { type: String, enum: BATCH_STATUSES, default: 'IN_TRANSIT' },
}, { timestamps: true });

export default mongoose.model('GreenLeafBatch', batchSchema);
