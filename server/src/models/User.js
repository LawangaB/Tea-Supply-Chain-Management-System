import mongoose from 'mongoose';
import { ROLE_CODES } from '../rules/permissions.js';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 20 },
  passwordHash: { type: String, required: true, select: false },
  roles: {
    type: [{ type: String, enum: ROLE_CODES }],
    validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'At least one role is required' },
  },
  status: { type: String, enum: ['ACTIVE', 'DEACTIVATED'], default: 'ACTIVE' },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
