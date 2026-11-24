import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getRooms, getRoomById, createRoom, updateRoom, deleteRoom, assignMember, vacateMember, getMyRoom
} from '../controllers/room.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/my',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.ROOMS,
    keyGenerator: (req) => cacheKeys.roomMy(req.user._id),
    isUserSpecific: true,
  }),
  getMyRoom
);

router.get(
  '/',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.ROOMS,
    keyGenerator: (req) => cacheKeys.roomList(req.query),
  }),
  getRooms
);

router.post('/', requireManager, createRoom);

router.get(
  '/:id',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.ROOMS,
    keyGenerator: (req) => cacheKeys.roomItem(req.params.id),
  }),
  getRoomById
);

router.put('/:id', requireManager, updateRoom);
router.delete('/:id', requireManager, deleteRoom);
router.put('/:id/assign', requireManager, assignMember);
router.put('/:id/vacate', requireManager, vacateMember);

export default router;
