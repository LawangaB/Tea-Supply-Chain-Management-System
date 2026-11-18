// /api/v1 – one router per area, mounted here.
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { lookups } from '../controllers/dashboard.controller.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import producersRoutes from './producers.routes.js';
import collectionsRoutes from './collections.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/auth', authRoutes);

// Everything below requires a session.
router.use(authenticate);

router.get('/lookups', lookups);
router.use('/users', usersRoutes);
router.use('/producers', producersRoutes);
router.use('/collections', collectionsRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
