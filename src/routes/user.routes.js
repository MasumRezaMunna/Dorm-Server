import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getUsers,
  getUserById,
  updateUserRole,
  deactivateUser,
  getPendingUsers,
} from '../controllers/user.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.USERS,
    keyGenerator: (req) => cacheKeys.userList(req.query),
    isManagerOnly: true,
  }),
  getUsers
);

router.get(
  '/pending',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.DASHBOARD,
    keyGenerator: () => cacheKeys.userPending(),
    isManagerOnly: true,
  }),
  getPendingUsers
);

router.get(
  '/:id',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.USERS,
    keyGenerator: (req) => cacheKeys.userItem(req.params.id),
  }),
  getUserById
);

router.put('/:id/role', requireManager, updateUserRole);
router.put('/:id/deactivate', requireManager, deactivateUser);

export default router;
