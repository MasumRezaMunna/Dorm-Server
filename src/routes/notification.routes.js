import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  getNotifications, markRead, markAllRead, deleteNotification,
} from '../controllers/notification.controller.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.put('/read-all', requireAuth, markAllRead);
router.put('/:id/read', requireAuth, markRead);
router.delete('/:id', requireAuth, deleteNotification);

export default router;
