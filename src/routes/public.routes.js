import { Router } from 'express';
import {
  getPublicOverview,
  getPublicNotices,
  getPublicNoticeById,
  getPublicRooms,
  getPublicRoomById,
  getPublicWeeklyMealPlan,
  getPublicMonthlyMealDetail,
  getPublicMealEntries,
  getPublicTodayMarketSchedule,
  getPublicUpcomingMarketSchedules,
  getPublicMarketScheduleHistory,
  getPublicExpenses,
  getPublicCommunityStats,
  getPublicSettings,
} from '../controllers/public.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

// ─── Public Overview & Settings ──────────────────────────────────────────────
router.get(
  '/overview',
  cacheMiddleware({
    ttl: CACHE_TTL.PUBLIC,
    keyGenerator: (req) => cacheKeys.publicOverview(req.query.year, req.query.month),
  }),
  getPublicOverview
);

router.get(
  '/settings',
  cacheMiddleware({
    ttl: CACHE_TTL.SETTINGS,
    keyGenerator: () => cacheKeys.publicSettings(),
  }),
  getPublicSettings
);

// ─── Public Notices ──────────────────────────────────────────────────────────
router.get(
  '/notices',
  cacheMiddleware({
    ttl: CACHE_TTL.NOTICES,
    keyGenerator: (req) => cacheKeys.publicNotices(req.query),
  }),
  getPublicNotices
);

router.get(
  '/notices/:id',
  cacheMiddleware({
    ttl: CACHE_TTL.NOTICES,
    keyGenerator: (req) => cacheKeys.publicNoticeItem(req.params.id),
  }),
  getPublicNoticeById
);

// ─── Public Rooms ────────────────────────────────────────────────────────────
router.get(
  '/rooms',
  cacheMiddleware({
    ttl: CACHE_TTL.ROOMS,
    keyGenerator: (req) => cacheKeys.publicRooms(req.query),
  }),
  getPublicRooms
);

router.get(
  '/rooms/:id',
  cacheMiddleware({
    ttl: CACHE_TTL.ROOMS,
    keyGenerator: (req) => cacheKeys.publicRoomItem(req.params.id),
  }),
  getPublicRoomById
);

// ─── Public Meals ────────────────────────────────────────────────────────────
router.get(
  '/meals/weekly-plan',
  cacheMiddleware({
    ttl: CACHE_TTL.WEEKLY_PLAN,
    keyGenerator: (req) => cacheKeys.publicWeeklyMealPlan(req.query.date),
  }),
  getPublicWeeklyMealPlan
);

router.get(
  '/meals/monthly-detail',
  cacheMiddleware({
    ttl: CACHE_TTL.PUBLIC,
    keyGenerator: (req) => cacheKeys.publicMonthlyMealDetail(req.query.year, req.query.month),
  }),
  getPublicMonthlyMealDetail
);

router.get(
  '/meals/entries',
  cacheMiddleware({
    ttl: CACHE_TTL.MEALS,
    keyGenerator: (req) => cacheKeys.publicMealEntries(req.query),
  }),
  getPublicMealEntries
);

// ─── Public Market / Bazar Schedules ─────────────────────────────────────────
router.get(
  '/market-schedules/today',
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: () => cacheKeys.publicTodayMarketSchedule(),
  }),
  getPublicTodayMarketSchedule
);

router.get(
  '/market-schedules/upcoming',
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: () => cacheKeys.publicUpcomingMarketSchedules(),
  }),
  getPublicUpcomingMarketSchedules
);

router.get(
  '/market-schedules/history',
  cacheMiddleware({
    ttl: CACHE_TTL.MARKET,
    keyGenerator: (req) => cacheKeys.publicMarketScheduleHistory(req.query),
  }),
  getPublicMarketScheduleHistory
);

// ─── Public Expenses ─────────────────────────────────────────────────────────
router.get(
  '/expenses',
  cacheMiddleware({
    ttl: CACHE_TTL.EXPENSES,
    keyGenerator: (req) => cacheKeys.publicExpenses(req.query),
  }),
  getPublicExpenses
);

// ─── Public Community Transparency ───────────────────────────────────────────
router.get(
  '/community',
  cacheMiddleware({
    ttl: CACHE_TTL.PUBLIC,
    keyGenerator: (req) => cacheKeys.publicCommunityStats(req.query.year, req.query.month),
  }),
  getPublicCommunityStats
);

export default router;
