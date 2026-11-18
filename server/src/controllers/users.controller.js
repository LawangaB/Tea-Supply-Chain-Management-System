import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../middleware/errors.js';
import { audit } from '../services/audit.js';
import { ROLE_CODES } from '../rules/permissions.js';
import { USER_STATUSES } from '../rules/enums.js';
import { userOut } from '../serializers.js';
import { assertUuid, icontains } from './util.js';

export async function listUsers(req, res) {
  const { q, role, status } = req.query;
  // An unknown role/status matches nothing (as before) instead of failing the enum cast.
  if ((role && !ROLE_CODES.includes(String(role))) || (status && !USER_STATUSES.includes(String(status)))) {
    return res.json({ items: [], total: 0 });
  }
  const where = {};
  if (q) where.OR = [{ fullName: icontains(q) }, { email: icontains(q) }];
  if (role) where.roles = { has: String(role) };
  if (status) where.status = String(status);
  const items = await prisma.user.findMany({ where, orderBy: { fullName: 'asc' }, take: 200 });
  res.json({ items: items.map(userOut), total: items.length });
}

export async function createUser(req, res) {
  const { password, ...data } = req.body;
  const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  await audit({ req, action: 'USER_CREATED', entityType: 'User', entityId: user.id,
    newValue: { email: user.email, roles: user.roles } });
  res.status(201).json(userOut(user));
}

export async function updateUser(req, res) {
  assertUuid(req.params.id, 'User');
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw ApiError.notFound('User not found');
  const { password, ...changes } = req.body;

  const isSelf = user.id === req.user.id;
  if (isSelf && changes.status === 'DEACTIVATED') {
    throw ApiError.conflict('You cannot deactivate your own account', [{ field: 'status', message: 'Cannot deactivate yourself' }]);
  }
  if (isSelf && changes.roles && !changes.roles.includes('ADM')) {
    throw ApiError.conflict('You cannot remove your own administrator role', [{ field: 'roles', message: 'Cannot remove your own ADM role' }]);
  }

  const oldValue = { fullName: user.fullName, phone: user.phone, roles: user.roles, status: user.status };
  const data = { ...changes };
  if (changes.status === 'ACTIVE') { // re-activation also clears any lockout
    data.failedLogins = 0;
    data.lockedUntil = null;
  }
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({ where: { id: user.id }, data });

  const action = changes.status && changes.status !== oldValue.status
    ? (changes.status === 'DEACTIVATED' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED')
    : changes.roles ? 'USER_ROLES_CHANGED' : 'USER_UPDATED';
  await audit({ req, action, entityType: 'User', entityId: user.id, oldValue,
    newValue: { ...changes, ...(password ? { password: '(changed)' } : {}) } });
  res.json(userOut(updated));
}
