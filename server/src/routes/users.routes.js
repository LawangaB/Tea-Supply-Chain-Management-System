// Users & roles (ADM).
import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validation/schemas.js';
import * as users from '../controllers/users.controller.js';

const router = Router();

router.get('/', authorize('user:read'), users.listUsers);
router.post('/', authorize('user:create'), validate(createUserSchema), users.createUser);
router.patch('/:id', authorize('user:update'), validate(updateUserSchema), users.updateUser);

export default router;
