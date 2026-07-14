import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getPayments, createPayment, getPaymentsByMember, updatePayment, deletePayment
} from '../controllers/payment.controller.js';

const router = Router();

router.get('/', requireManager, getPayments);
router.post('/', requireManager, createPayment);
router.get('/member/:memberId', requireAuth, getPaymentsByMember);
router.put('/:id', requireManager, updatePayment);
router.delete('/:id', requireManager, deletePayment);

export default router;
