import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMyProfile,
  updateMyProfile,
} from '../controllers/member.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/me',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MEMBERS,
    keyGenerator: (req) => cacheKeys.memberProfile(req.user._id),
    isUserSpecific: true,
  }),
  getMyProfile
);

router.put('/me', requireAuth, updateMyProfile);

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.MEMBERS,
    keyGenerator: (req) => cacheKeys.memberList(req.query),
    isManagerOnly: true,
  }),
  getMembers
);

router.post('/', requireManager, createMember);

router.get(
  '/:id',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MEMBERS,
    keyGenerator: (req) => cacheKeys.memberItem(req.params.id),
  }),
  getMemberById
);

router.put('/:id', requireManager, updateMember);
router.delete('/:id', requireManager, deleteMember);

export default router;
