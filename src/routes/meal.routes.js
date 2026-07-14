import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getMealEntries, createMealEntry, updateMealEntry, deleteMealEntry,
  getMonthlySummary, createBulkMealEntries, getMyMeals, getMonthlyDetail,
  getWeeklyPlan, upsertWeeklyPlan,
} from '../controllers/meal.controller.js';

const router = Router();

router.get('/my',             requireAuth,    getMyMeals);
router.get('/summary',        requireAuth,    getMonthlySummary);
router.get('/monthly-detail', requireAuth,    getMonthlyDetail);
router.get('/weekly-plan',    requireAuth,    getWeeklyPlan);
router.put('/weekly-plan',    requireManager, upsertWeeklyPlan);

router.get('/',               requireAuth,    getMealEntries);
router.post('/bulk',          requireManager, createBulkMealEntries);
router.post('/',              requireManager, createMealEntry);
router.put('/:id',            requireManager, updateMealEntry);
router.delete('/:id',         requireManager, deleteMealEntry);

export default router;
