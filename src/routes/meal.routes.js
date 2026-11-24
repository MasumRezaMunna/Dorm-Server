import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getMealEntries, createMealEntry, updateMealEntry, deleteMealEntry,
  getMonthlySummary, createBulkMealEntries, getMyMeals, getMonthlyDetail,
  getWeeklyPlan, upsertWeeklyPlan,
} from '../controllers/meal.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/my',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MEALS,
    keyGenerator: (req) => cacheKeys.myMeals(req.user._id, req.query.year, req.query.month),
    isUserSpecific: true,
  }),
  getMyMeals
);

router.get(
  '/summary',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MEALS,
    keyGenerator: (req) => cacheKeys.mealSummary(req.query.year, req.query.month),
  }),
  getMonthlySummary
);

router.get(
  '/monthly-detail',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.FINANCIAL,
    keyGenerator: (req) => cacheKeys.mealMonthlyDetail(req.query.year, req.query.month),
  }),
  getMonthlyDetail
);

router.get(
  '/weekly-plan',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.WEEKLY_PLAN,
    keyGenerator: (req) => cacheKeys.weeklyPlan(req.query.date),
  }),
  getWeeklyPlan
);

router.put('/weekly-plan', requireManager, upsertWeeklyPlan);

router.get(
  '/',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.MEALS,
    keyGenerator: (req) => cacheKeys.mealList(req.query),
  }),
  getMealEntries
);

router.post('/bulk', requireManager, createBulkMealEntries);
router.post('/', requireManager, createMealEntry);
router.put('/:id', requireManager, updateMealEntry);
router.delete('/:id', requireManager, deleteMealEntry);

export default router;
