import mongoose from 'mongoose';
import { weightErrors, roundKg } from '../rules/netWeight.js';
import { RECEIPT_NO_RE } from '../rules/codes.js';

const { ObjectId } = mongoose.Schema.Types;

const collectionSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true, match: RECEIPT_NO_RE },
  producer: { type: ObjectId, ref: 'Producer', required: true, index: true },
  field: { type: ObjectId, ref: 'Field', required: true },
  centre: { type: ObjectId, ref: 'CollectionCentre' },
  collector: { type: ObjectId, ref: 'User', required: true },
  collectedAt: { type: Date, required: true, default: Date.now, index: true },
  grossKg: { type: Number, required: true },
  tareKg: { type: Number, required: true },
  netKg: { type: Number, required: true },
  purchasePrice: { type: ObjectId, ref: 'PriceVersion', required: true },
  pricePerKg: { type: Number, required: true }, // snapshot of the price version used
  batch: { type: ObjectId, ref: 'GreenLeafBatch', required: true },
}, { timestamps: true });

// Defence in depth: the schema itself refuses inconsistent weights.
collectionSchema.pre('validate', function checkWeights() {
  for (const e of weightErrors(this.grossKg, this.tareKg)) this.invalidate(e.field, e.message);
  if (this.netKg !== roundKg(this.grossKg - this.tareKg)) {
    this.invalidate('netKg', 'Net weight must equal gross minus tare');
  }
});

export default mongoose.model('Collection', collectionSchema);
