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

const router = Router();

// ─── Public Overview & Settings ──────────────────────────────────────────────
router.get('/overview', getPublicOverview);
router.get('/settings', getPublicSettings);

// ─── Public Notices ──────────────────────────────────────────────────────────
router.get('/notices', getPublicNotices);
router.get('/notices/:id', getPublicNoticeById);

// ─── Public Rooms ────────────────────────────────────────────────────────────
router.get('/rooms', getPublicRooms);
router.get('/rooms/:id', getPublicRoomById);

// ─── Public Meals ────────────────────────────────────────────────────────────
router.get('/meals/weekly-plan', getPublicWeeklyMealPlan);
router.get('/meals/monthly-detail', getPublicMonthlyMealDetail);
router.get('/meals/entries', getPublicMealEntries);

// ─── Public Market / Bazar Schedules ─────────────────────────────────────────
router.get('/market-schedules/today', getPublicTodayMarketSchedule);
router.get('/market-schedules/upcoming', getPublicUpcomingMarketSchedules);
router.get('/market-schedules/history', getPublicMarketScheduleHistory);

// ─── Public Expenses ─────────────────────────────────────────────────────────
router.get('/expenses', getPublicExpenses);

// ─── Public Community Transparency ───────────────────────────────────────────
router.get('/community', getPublicCommunityStats);

export default router;

