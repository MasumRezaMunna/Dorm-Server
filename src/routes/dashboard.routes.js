import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import { getManagerDashboard, getMemberDashboard, getCommunityStats } from '../controllers/dashboard.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/manager',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.DASHBOARD,
    keyGenerator: (req) => cacheKeys.managerDashboard(req.query.year, req.query.month),
    isManagerOnly: true,
  }),
  getManagerDashboard
);

router.get(
  '/member',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.DASHBOARD,
    keyGenerator: (req) => cacheKeys.memberDashboard(req.user._id, req.query.year, req.query.month),
    isUserSpecific: true,
  }),
  getMemberDashboard
);

router.get(
  '/community',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.DASHBOARD,
    keyGenerator: (req) => cacheKeys.communityStats(req.query.year, req.query.month),
  }),
  getCommunityStats
);

export default router;
