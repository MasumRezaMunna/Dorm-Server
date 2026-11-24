import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.SETTINGS,
    keyGenerator: () => cacheKeys.settings(),
  }),
  getSettings
);

router.put('/', requireManager, updateSettings);

export default router;
