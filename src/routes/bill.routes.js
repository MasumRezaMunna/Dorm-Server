import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getBills, getBillById, createBill, updateBill, deleteBill, getMyBills, createBulkBills,
} from '../controllers/bill.controller.js';

const router = Router();

router.get('/my', requireAuth, getMyBills);
router.get('/', requireManager, getBills);
router.post('/bulk', requireManager, createBulkBills);
router.post('/', requireManager, createBill);
router.get('/:id', requireAuth, getBillById);
router.put('/:id', requireManager, updateBill);
router.delete('/:id', requireManager, deleteBill);

export default router;
