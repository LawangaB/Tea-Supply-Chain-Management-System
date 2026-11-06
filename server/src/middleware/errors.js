import mongoose from 'mongoose';
import { ZodError } from 'zod';

/** Throw this from anywhere; the error handler turns it into {error:{code,message,fields}}. */
export class ApiError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
  static badRequest(message, fields = []) { return new ApiError(400, 'VALIDATION_ERROR', message, fields); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, 'UNAUTHENTICATED', message); }
  static forbidden(message = "You don't have access to this resource") { return new ApiError(403, 'FORBIDDEN', message); }
  static notFound(message = 'Not found') { return new ApiError(404, 'NOT_FOUND', message); }
  static conflict(message, fields = []) { return new ApiError(409, 'CONFLICT', message, fields); }
}

export function zodFields(err) {
  return err.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found`, fields: [] } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let e = err;
  if (err instanceof ZodError) {
    e = ApiError.badRequest('Validation failed', zodFields(err));
  } else if (err instanceof mongoose.Error.ValidationError) {
    e = ApiError.badRequest('Validation failed',
      Object.values(err.errors).map((v) => ({ field: v.path, message: v.message })));
  } else if (err instanceof mongoose.Error.CastError) {
    e = ApiError.badRequest(`Invalid ${err.path}`, [{ field: err.path, message: 'Invalid value' }]);
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || { _: 1 })[0];
    e = ApiError.conflict(`A record with this ${field} already exists`, [{ field, message: 'Already exists' }]);
  } else if (err?.type === 'entity.parse.failed') {
    e = ApiError.badRequest('Malformed JSON body');
  }
  if (!(e instanceof ApiError)) {
    if (process.env.NODE_ENV !== 'test' || process.env.DEBUG_ERRORS) console.error(err);
    e = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, fields: e.fields } });
}
