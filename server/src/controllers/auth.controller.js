import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Producer from '../models/Producer.js';
import { ApiError } from '../middleware/errors.js';
import { COOKIE_NAME, cookieOptions, signToken } from '../middleware/auth.js';
import { allowedActions, menuFor, ROLES } from '../rules/permissions.js';
import { audit } from '../services/audit.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const INVALID = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

async function sessionPayload(user) {
  const producer = user.roles.includes('FRM')
    ? await Producer.findOne({ user: user._id ?? user.id }).select('_id code fullName').lean()
    : null;
  return {
    user: {
      id: String(user._id ?? user.id),
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      roleNames: user.roles.map((r) => ROLES[r]),
    },
    permissions: allowedActions(user.roles),
    menu: menuFor(user.roles),
    producer,
  };
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit({ req, action: 'LOGIN_FAILED', entityType: 'User', newValue: { email }, reason: 'unknown email' });
    throw INVALID();
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const mins = Math.ceil((user.lockedUntil - now) / 60000);
    await audit({ req, user: user._id, action: 'LOGIN_BLOCKED', entityType: 'User', entityId: user._id, reason: 'locked' });
    throw new ApiError(423, 'ACCOUNT_LOCKED', `Too many failed sign-in attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }
  if (user.lockedUntil && user.lockedUntil <= now) {
    user.lockedUntil = null;
    user.failedLogins = 0;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLogins += 1;
    let reason = `wrong password (${user.failedLogins})`;
    if (user.failedLogins >= MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60000);
      user.failedLogins = 0;
      reason = `locked for ${LOCK_MINUTES} min`;
    }
    await user.save();
    await audit({ req, user: user._id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user._id, reason });
    throw INVALID();
  }

  if (user.status !== 'ACTIVE') {
    await audit({ req, user: user._id, action: 'LOGIN_BLOCKED', entityType: 'User', entityId: user._id, reason: 'deactivated' });
    throw new ApiError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated. Contact your administrator.');
  }

  user.failedLogins = 0;
  user.lockedUntil = null;
  user.lastLoginAt = now;
  await user.save();
  await audit({ req, user: user._id, action: 'LOGIN_SUCCESS', entityType: 'User', entityId: user._id });

  res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
  res.json(await sessionPayload(user));
}

export async function logout(req, res) {
  const { maxAge, ...opts } = cookieOptions(); // eslint-disable-line no-unused-vars
  res.clearCookie(COOKIE_NAME, opts);
  if (req.user) await audit({ req, action: 'LOGOUT', entityType: 'User', entityId: req.user.id });
  res.status(204).end();
}

export async function me(req, res) {
  res.json(await sessionPayload(req.user));
}
