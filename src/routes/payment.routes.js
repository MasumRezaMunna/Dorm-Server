import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getPayments, createPayment, getPaymentsByMember, updatePayment, deletePayment
} from '../controllers/payment.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.PAYMENT,
    keyGenerator: (req) => cacheKeys.paymentList(req.query),
    isManagerOnly: true,
  }),
  getPayments
);

router.post('/', requireManager, createPayment);

router.get(
  '/member/:memberId',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.PAYMENT,
    keyGenerator: (req) => cacheKeys.paymentMember(req.params.memberId),
  }),
  getPaymentsByMember
);

router.put('/:id', requireManager, updatePayment);
router.delete('/:id', requireManager, deletePayment);

export default router;
