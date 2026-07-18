import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary, getMemberExpenses,
} from '../controllers/expense.controller.js';

const router = Router();

router.get('/', requireManager, getExpenses);
router.get('/summary', requireManager, getExpenseSummary);
router.get('/member', requireAuth, getMemberExpenses);
router.post('/', requireManager, createExpense);
router.put('/:id', requireManager, updateExpense);
router.delete('/:id', requireManager, deleteExpense);

export default router;
