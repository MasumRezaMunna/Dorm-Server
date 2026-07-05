import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getPayments, createPayment, getPaymentsByBill, updatePayment, deletePayment
} from '../controllers/payment.controller.js';

const router = Router();

router.get('/', requireManager, getPayments);
router.post('/', requireManager, createPayment);
router.get('/bill/:billId', requireAuth, getPaymentsByBill);
router.put('/:id', requireManager, updatePayment);
router.delete('/:id', requireManager, deletePayment);

export default router;
