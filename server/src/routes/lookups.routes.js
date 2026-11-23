// Lookup lists for forms (centres, organisations, roles). Any signed-in user.
import { Router } from 'express';
import { lookups } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/', lookups);

export default router;
