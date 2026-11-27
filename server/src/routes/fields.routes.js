// Fields – US-016 (ESPTSCMS-18). Adding a field is POST /producers/:id/fields.
import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateFieldSchema } from '../validation/schemas.js';
import * as fields from '../controllers/fields.controller.js';

const router = Router();

router.get('/', authorize('field:read'), fields.listFields);
router.get('/:id', authorize('field:read'), fields.getField);
router.patch('/:id', authorize('field:update'), validate(updateFieldSchema), fields.updateField);

export default router;
