import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/index.js';

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

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** Postgres SQLSTATE, message and constraint name, from the pg driver adapter's error metadata. */
function pgDetails(err) {
  const cause = err.meta?.driverAdapterError?.cause ?? {};
  const code = cause.originalCode ?? cause.code;
  const message = cause.originalMessage ?? cause.message ?? err.message ?? '';
  const constraint = cause.constraint?.index ?? cause.constraint?.name
    ?? message.match(/constraint "([^"]+)"/)?.[1] ?? null;
  // Classic (non-adapter) form: meta.target lists the columns.
  const target = Array.isArray(err.meta?.target) ? err.meta.target[0] : err.meta?.target;
  const table = cause.table ?? message.match(/(?:relation|table) "([^"]+)"/)?.[1] ?? null;
  return { code, message, constraint, target, table };
}

/**
 * API field name from a constraint name. Constraints are named "<table>_<column(s)>_<key|fkey|check>"
 * (Prisma's defaults, and our CHECKs in the db_rules migration): app_user_email_key → email,
 * collection_field_id_fkey → fieldId, collection_net_kg_check → netKg.
 */
const TABLES = ['green_leaf_batch', 'collection_centre', 'producer_org', 'price_version', 'collection',
  'app_user', 'audit_log', 'producer', 'counter', 'field'];
function fieldOf({ constraint, target, table: errTable }) {
  if (!constraint) return target ? camel(String(target)) : '_';
  let rest = constraint.replace(/_(key|fkey|check)$/, '');
  // Prefer the table named in the error ("producer_org_id_check" is on producer, not producer_org).
  const table = (errTable && rest.startsWith(`${errTable}_`)) ? errTable : TABLES.find((t) => rest.startsWith(`${t}_`));
  if (table) rest = rest.slice(table.length + 1);
  return camel(rest);
}

const CHECK_MESSAGES = {
  netKg: 'Net weight must equal gross minus tare',
  grossKg: 'Gross weight must be greater than 0 and at most 10000 kg',
  tareKg: 'Tare weight must be at least 0 and less than gross weight',
  areaHa: 'Area must be greater than 0',
  orgId: 'Producer organisation is required for organisation members',
  roles: 'At least one role is required',
};

/** Prisma / Postgres errors → the same API errors the Mongo version produced. */
function fromDatabase(err) {
  const isKnown = err instanceof Prisma.PrismaClientKnownRequestError;
  const details = pgDetails(err);
  const { code: sqlState, message } = details;

  if ((isKnown && err.code === 'P2002') || sqlState === '23505') { // unique (Mongo 11000)
    const field = fieldOf(details);
    return ApiError.conflict(`A record with this ${field} already exists`, [{ field, message: 'Already exists' }]);
  }
  if (isKnown && err.code === 'P2025') return ApiError.notFound(); // record to update/delete not found
  if ((isKnown && err.code === 'P2003') || sqlState === '23503') { // foreign key
    // e.g. a centre/producer/field that does not exist (or, on delete, a record still referenced)
    return ApiError.badRequest('Validation failed', [{ field: fieldOf(details), message: 'Referenced record not found' }]);
  }
  if (sqlState === '23514' || /violates check constraint/i.test(message)) { // CHECK constraint
    const field = fieldOf(details);
    return ApiError.badRequest('Validation failed', [{ field, message: CHECK_MESSAGES[field] ?? 'Invalid value' }]);
  }
  if ((isKnown && err.code === 'P2023') || sqlState === '22P02') { // malformed value, e.g. not a UUID
    return ApiError.badRequest('Invalid id', [{ field: '_', message: 'Invalid value' }]);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let e = err;
  if (err instanceof ZodError) {
    e = ApiError.badRequest('Validation failed', zodFields(err));
  } else if (err?.type === 'entity.parse.failed') {
    e = ApiError.badRequest('Malformed JSON body');
  } else if (!(err instanceof ApiError)) {
    e = fromDatabase(err) ?? err;
  }
  if (!(e instanceof ApiError)) {
    if (process.env.NODE_ENV !== 'test' || process.env.DEBUG_ERRORS) console.error(err);
    e = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
  res.status(e.status).json({ error: { code: e.code, message: e.message, fields: e.fields } });
}

export { fromDatabase as mapDatabaseError };
