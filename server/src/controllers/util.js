import { ApiError } from '../middleware/errors.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id) => typeof id === 'string' && UUID_RE.test(id);

/** 404 instead of a database cast error for malformed ids in the URL. */
export function assertUuid(id, what = 'Record') {
  if (!isUuid(id)) throw ApiError.notFound(`${what} not found`);
}

/** Case-insensitive substring filter (replaces the escaped-regex search of the Mongo version). */
export const icontains = (s) => ({ contains: String(s), mode: 'insensitive' });

export function pageParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
