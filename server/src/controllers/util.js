import mongoose from 'mongoose';
import { ApiError } from '../middleware/errors.js';

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 404 instead of a cast error for malformed ids in the URL. */
export function assertObjectId(id, what = 'Record') {
  if (!mongoose.isValidObjectId(id) || !/^[0-9a-fA-F]{24}$/.test(String(id))) {
    throw ApiError.notFound(`${what} not found`);
  }
}

export function pageParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
