import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary, getMemberExpenses,
} from '../controllers/expense.controller.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { cacheKeys, CACHE_TTL } from '../utils/cacheKeys.js';

const router = Router();

router.get(
  '/',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.EXPENSES,
    keyGenerator: (req) => cacheKeys.expenseList(req.query),
    isManagerOnly: true,
  }),
  getExpenses
);

router.get(
  '/summary',
  requireManager,
  cacheMiddleware({
    ttl: CACHE_TTL.EXPENSES,
    keyGenerator: (req) => cacheKeys.expenseSummary(req.query.year, req.query.month),
    isManagerOnly: true,
  }),
  getExpenseSummary
);

router.get(
  '/member',
  requireAuth,
  cacheMiddleware({
    ttl: CACHE_TTL.EXPENSES,
    keyGenerator: (req) => cacheKeys.memberExpenses(req.query),
  }),
  getMemberExpenses
);

router.post('/', requireManager, createExpense);
router.put('/:id', requireManager, updateExpense);
router.delete('/:id', requireManager, deleteExpense);

export default router;
