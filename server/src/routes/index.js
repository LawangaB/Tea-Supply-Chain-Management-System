import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema, updateUserSchema, loginSchema, createProducerSchema, rejectProducerSchema, fieldSchema,
} from '../validation/schemas.js';
import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/users.controller.js';
import * as producers from '../controllers/producers.controller.js';
import * as collections from '../controllers/collections.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const router = Router();

// Per-IP brake on password guessing (per-account lockout is handled in the controller).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts from this network. Try again later.', fields: [] } }),
});

/** Like authenticate, but continues anonymously when there is no valid session. */
const optionalAuth = async (req, res, next) => {
  try { await authenticate(req, res, () => {}); } catch { /* anonymous */ }
  next();
};

// --- Auth (US-001) ---
router.post('/auth/login', loginLimiter, validate(loginSchema), auth.login);
router.post('/auth/logout', optionalAuth, auth.logout);
router.get('/auth/me', authenticate, auth.me);

// Everything below requires a session.
router.use(authenticate);

router.get('/lookups', dashboard.lookups);

// --- Users & roles (ADM) ---
router.get('/users', authorize('user:read'), users.listUsers);
router.post('/users', authorize('user:create'), validate(createUserSchema), users.createUser);
router.patch('/users/:id', authorize('user:update'), validate(updateUserSchema), users.updateUser);

// --- Producers (US-014) ---
router.get('/producers', authorize('producer:read'), producers.listProducers);
router.post('/producers', authorize('producer:create'), validate(createProducerSchema), producers.createProducer);
router.get('/producers/:id', authorize('producer:read'), producers.getProducer);
router.post('/producers/:id/verify', authorize('producer:verify'), producers.verifyProducer);
router.post('/producers/:id/reject', authorize('producer:verify'), validate(rejectProducerSchema), producers.rejectProducer);
router.get('/producers/:id/fields', authorize('producer:read'), producers.listFields);
router.post('/producers/:id/fields', authorize('field:create'), validate(fieldSchema), producers.createField);

// --- Collections (US-020/021/022) ---
router.get('/collections', authorize('collection:read'), collections.listCollections);
router.post('/collections', authorize('collection:create'), collections.createCollection);
router.get('/collections/:id/receipt', authorize('receipt:read'), collections.getReceipt);

// --- Dashboard ---
router.get('/dashboard/today', authorize('dashboard:read'), dashboard.today);

export default router;
