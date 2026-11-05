import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ApiError } from '../middleware/errors.js';
import { audit } from '../services/audit.js';
import { escapeRegex } from './util.js';

export async function listUsers(req, res) {
  const { q, role, status } = req.query;
  const filter = {};
  if (q) {
    const re = new RegExp(escapeRegex(String(q)), 'i');
    filter.$or = [{ fullName: re }, { email: re }];
  }
  if (role) filter.roles = String(role);
  if (status) filter.status = String(status);
  const items = await User.find(filter).sort({ fullName: 1 }).limit(200);
  res.json({ items, total: items.length });
}

export async function createUser(req, res) {
  const { password, ...data } = req.body;
  const user = await User.create({ ...data, passwordHash: await bcrypt.hash(password, 10) });
  await audit({ req, action: 'USER_CREATED', entityType: 'User', entityId: user._id,
    newValue: { email: user.email, roles: user.roles } });
  res.status(201).json(user);
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const { password, ...changes } = req.body;

  const isSelf = String(user._id) === req.user.id;
  if (isSelf && changes.status === 'DEACTIVATED') {
    throw ApiError.conflict('You cannot deactivate your own account', [{ field: 'status', message: 'Cannot deactivate yourself' }]);
  }
  if (isSelf && changes.roles && !changes.roles.includes('ADM')) {
    throw ApiError.conflict('You cannot remove your own administrator role', [{ field: 'roles', message: 'Cannot remove your own ADM role' }]);
  }

  const oldValue = { fullName: user.fullName, phone: user.phone, roles: user.roles, status: user.status };
  Object.assign(user, changes);
  if (changes.status === 'ACTIVE') { // re-activation also clears any lockout
    user.failedLogins = 0;
    user.lockedUntil = null;
  }
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  const action = changes.status && changes.status !== oldValue.status
    ? (changes.status === 'DEACTIVATED' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED')
    : changes.roles ? 'USER_ROLES_CHANGED' : 'USER_UPDATED';
  await audit({ req, action, entityType: 'User', entityId: user._id, oldValue,
    newValue: { ...changes, ...(password ? { password: '(changed)' } : {}) } });
  res.json(user);
}
