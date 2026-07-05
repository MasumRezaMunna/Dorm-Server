import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import { getManagerDashboard, getMemberDashboard, getCommunityStats } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/manager', requireManager, getManagerDashboard);
router.get('/member', requireAuth, getMemberDashboard);
router.get('/community', requireAuth, getCommunityStats);

export default router;
