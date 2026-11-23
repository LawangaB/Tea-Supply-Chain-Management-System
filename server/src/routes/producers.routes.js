// Producers and their fields – US-014 (ESPTSCMS-17).
import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createProducerSchema, rejectProducerSchema, fieldSchema } from '../validation/schemas.js';
import * as producers from '../controllers/producers.controller.js';

const router = Router();

router.get('/', authorize('producer:read'), producers.listProducers);
router.post('/', authorize('producer:create'), validate(createProducerSchema), producers.createProducer);
router.get('/:id', authorize('producer:read'), producers.getProducer);
router.post('/:id/verify', authorize('producer:verify'), producers.verifyProducer);
router.post('/:id/reject', authorize('producer:verify'), validate(rejectProducerSchema), producers.rejectProducer);
router.get('/:id/fields', authorize('producer:read'), producers.listFields);
router.post('/:id/fields', authorize('field:create'), validate(fieldSchema), producers.createField);

export default router;
