import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';

const router = Router();

router.get('/', requireAuth, getSettings);
router.put('/', requireManager, updateSettings);

export default router;
