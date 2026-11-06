import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import Producer from '../models/Producer.js';
import { scopeFor } from '../rules/permissions.js';
import { ApiError } from './errors.js';

export const COOKIE_NAME = 'st_session';

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd, // HTTPS only in production
    sameSite: env.isProd ? 'none' : 'lax', // client and API are on different domains in production
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}

export const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

/**
 * Requires a valid session. The user is re-loaded on every request so that
 * deactivation and role changes take effect immediately.
 */
export async function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }
  const user = await User.findById(payload.sub).lean();
  if (!user || user.status !== 'ACTIVE') throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  req.user = { id: String(user._id), roles: user.roles, fullName: user.fullName, email: user.email };
  next();
}

/**
 * Role-based access check against the permission matrix.
 * Sets req.scope to 'all' or 'own' for the controller to apply record ownership.
 */
export const authorize = (action) => (req, res, next) => {
  const scope = scopeFor(req.user?.roles, action);
  if (!scope) throw ApiError.forbidden();
  req.scope = scope;
  next();
};

/** IDs of the producer records linked to the signed-in user (FRM "own" scope). */
export async function ownProducerIds(req) {
  if (!req._ownProducerIds) {
    req._ownProducerIds = (await Producer.find({ user: req.user.id }).select('_id').lean()).map((p) => String(p._id));
  }
  return req._ownProducerIds;
}

/** Throws 403 when the scope is 'own' and the producer isn't the user's. */
export async function assertOwnProducer(req, producerId) {
  if (req.scope !== 'own') return;
  const own = await ownProducerIds(req);
  if (!own.includes(String(producerId))) throw ApiError.forbidden();
}
