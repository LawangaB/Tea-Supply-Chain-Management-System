// Dashboard (ESPTSCMS-145).
import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/today', authorize('dashboard:read'), dashboard.today);

export default router;
