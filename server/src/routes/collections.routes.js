// Collections, batch IDs and receipts – US-020/021/022 (ESPTSCMS-20, -83, -84).
import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import * as collections from '../controllers/collections.controller.js';

const router = Router();

router.get('/', authorize('collection:read'), collections.listCollections);
router.post('/', authorize('collection:create'), collections.createCollection);
router.get('/:id/receipt', authorize('receipt:read'), collections.getReceipt);

export default router;
