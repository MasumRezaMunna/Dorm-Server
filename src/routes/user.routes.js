import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getUsers,
  getUserById,
  updateUserRole,
  deactivateUser,
} from '../controllers/user.controller.js';

const router = Router();

router.get('/', requireManager, getUsers);
router.get('/:id', requireAuth, getUserById);
router.put('/:id/role', requireManager, updateUserRole);
router.put('/:id/deactivate', requireManager, deactivateUser);

export default router;
