import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getNotices, getNoticeById, createNotice, updateNotice, deleteNotice, togglePin,
} from '../controllers/notice.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.NOTICES,
    keyGenerator: (req) => cacheKeys.noticeList(req.query),
  }),
  getNotices
);

router.get(
  '/:id',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.NOTICES,
    keyGenerator: (req) => cacheKeys.noticeItem(req.params.id),
  }),
  getNoticeById
);

router.post('/', requireManager, createNotice);
router.put('/:id', requireManager, updateNotice);
router.delete('/:id', requireManager, deleteNotice);
router.put('/:id/pin', requireManager, togglePin);

export default router;
