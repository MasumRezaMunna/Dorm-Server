import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getVisitors, logVisitor, updateVisitor, checkOutVisitor,
} from '../controllers/visitor.controller.js';

const router = Router();

router.get('/', requireManager, getVisitors);
router.post('/', requireAuth, logVisitor);
router.put('/:id', requireManager, updateVisitor);
router.put('/:id/checkout', requireManager, checkOutVisitor);

export default router;
