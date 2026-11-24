import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  createMarketSchedule,
  getMarketSchedules,
  getMarketScheduleById,
  updateMarketSchedule,
  deleteMarketSchedule,
  getTodaySchedule,
  getUpcomingSchedules,
  getScheduleHistory,
  getMySchedules,
  getRotationSuggestion,
  getMarketStats,
} from '../controllers/marketSchedule.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

// ─── Named routes BEFORE /:id to prevent Express param shadowing ─────────────

// Shared (member + manager)
router.get(
  '/today',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: () => cacheKeys.marketToday(),
  }),
  getTodaySchedule
);

router.get(
  '/upcoming',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: () => cacheKeys.marketUpcoming(),
  }),
  getUpcomingSchedules
);

router.get(
  '/history',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.marketHistory(req.query),
  }),
  getScheduleHistory
);

router.get(
  '/me',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.marketMy(req.user._id),
    isUserSpecific: true,
  }),
  getMySchedules
);

// Manager-only
router.get(
  '/rotation-suggestion',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: () => cacheKeys.marketRotation(),
    isManagerOnly: true,
  }),
  getRotationSuggestion
);

router.get(
  '/stats',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.marketStats(req.query.year, req.query.month),
    isManagerOnly: true,
  }),
  getMarketStats
);

// ─── Resource routes ─────────────────────────────────────────────────────────

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.marketList(req.query),
    isManagerOnly: true,
  }),
  getMarketSchedules
);

router.post('/', requireManager, createMarketSchedule);

router.get(
  '/:id',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.marketItem(req.params.id),
    isManagerOnly: true,
  }),
  getMarketScheduleById
);

router.patch('/:id', requireManager, updateMarketSchedule);
router.delete('/:id', requireManager, deleteMarketSchedule);

export default router;
