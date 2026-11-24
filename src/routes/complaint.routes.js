import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getComplaints, getComplaintById, createComplaint, updateComplaint, resolveComplaint, getMyComplaints, deleteComplaint
} from '../controllers/complaint.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/my',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.COMPLAINTS,
    keyGenerator: (req) => cacheKeys.complaintMy(req.user._id),
    isUserSpecific: true,
  }),
  getMyComplaints
);

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.COMPLAINTS,
    keyGenerator: (req) => cacheKeys.complaintList(req.query),
    isManagerOnly: true,
  }),
  getComplaints
);

router.post('/', requireAuth, createComplaint);

router.get(
  '/:id',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.COMPLAINTS,
    keyGenerator: (req) => cacheKeys.complaintItem(req.params.id),
  }),
  getComplaintById
);

router.put('/:id', requireManager, updateComplaint);
router.delete('/:id', requireManager, deleteComplaint);
router.put('/:id/resolve', requireManager, resolveComplaint);

export default router;
