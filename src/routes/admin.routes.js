import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { cacheMetrics } from '../utils/cacheMetrics.js';

const router = Router();

/**
 * GET /api/admin/cache-stats
 * Protected manager/admin-only monitoring endpoint.
 * Returns real-time caching metrics, hit ratios, and Redis status without exposing credentials.
 */
router.get('/cache-stats', requireAuth, requireRole('manager', 'admin'), async (_req, res, next) => {
  try {
    const stats = await cacheMetrics.getStats();
    return res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
