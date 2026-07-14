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

const router = Router();

// ─── Named routes BEFORE /:id to prevent Express param shadowing ─────────────

// Shared (member + manager)
router.get('/today',    requireAuth, getTodaySchedule);
router.get('/upcoming', requireAuth, getUpcomingSchedules);
router.get('/history',  requireAuth, getScheduleHistory);
router.get('/me',       requireAuth, getMySchedules);

// Manager-only
router.get('/rotation-suggestion', requireManager, getRotationSuggestion);
router.get('/stats',               requireManager, getMarketStats);

// ─── Resource routes ─────────────────────────────────────────────────────────

router.get('/',     requireManager, getMarketSchedules);
router.post('/',    requireManager, createMarketSchedule);
router.get('/:id',  requireManager, getMarketScheduleById);
router.patch('/:id', requireManager, updateMarketSchedule);
router.delete('/:id', requireManager, deleteMarketSchedule);

export default router;
