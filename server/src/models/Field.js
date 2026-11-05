import mongoose from 'mongoose';

const round3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

const fieldSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. F-00417-B
  producer: { type: mongoose.Schema.Types.ObjectId, ref: 'Producer', required: true, index: true },
  division: { type: String, trim: true, maxlength: 80 },
  areaHa: { type: Number, required: true, min: [0.001, 'Area must be greater than 0'], max: 10000, set: round3 },
  variety: { type: String, trim: true, maxlength: 80 },
  gps: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
  },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

export default mongoose.model('Field', fieldSchema);
