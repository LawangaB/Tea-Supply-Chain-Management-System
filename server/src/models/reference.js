/** Small reference-data models: CollectionCentre, ProducerOrg, Counter, PriceVersion. */
import mongoose from 'mongoose';

const centreSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
});
export const CollectionCentre = mongoose.model('CollectionCentre', centreSchema);

const orgSchema = new mongoose.Schema({
  regNo: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
});
export const ProducerOrg = mongoose.model('ProducerOrg', orgSchema);

/** Sequence counters, e.g. { _id: "GL-2026-11", seq: 12 }. Incremented atomically with $inc. */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
}, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema);

const priceSchema = new mongoose.Schema({
  priceType: { type: String, enum: ['PURCHASE_GL', 'SELLING_FT'], required: true },
  version: { type: Number, required: true, min: 1 },
  pricePerKg: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'LKR' },
  effectiveFrom: { type: Date, required: true },
  status: { type: String, enum: ['DRAFT', 'APPROVED', 'RETIRED'], default: 'DRAFT' },
}, { timestamps: true });
priceSchema.index({ priceType: 1, version: 1 }, { unique: true });
export const PriceVersion = mongoose.model('PriceVersion', priceSchema);
