import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getNotices, getNoticeById, createNotice, updateNotice, deleteNotice, togglePin,
} from '../controllers/notice.controller.js';

const router = Router();

router.get('/', requireAuth, getNotices);
router.get('/:id', requireAuth, getNoticeById);
router.post('/', requireManager, createNotice);
router.put('/:id', requireManager, updateNotice);
router.delete('/:id', requireManager, deleteNotice);
router.put('/:id/pin', requireManager, togglePin);

export default router;
