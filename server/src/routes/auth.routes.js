// Auth – US-001 (ESPTSCMS-15). Mounted before `authenticate`: login is public.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validation/schemas.js';
import * as auth from '../controllers/auth.controller.js';

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

router.post('/login', loginLimiter, validate(loginSchema), auth.login);
router.post('/logout', optionalAuth, auth.logout);
router.get('/me', authenticate, auth.me);

export default router;
