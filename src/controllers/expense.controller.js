import Expense from '../models/expense.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import { calculateTotalGroceryCost, calculateTotalCommonCost } from '../utils/calculations.js';

export const getExpenses = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { expenseType, month, year } = req.query;
    const filter = {};
    if (expenseType) filter.expenseType = expenseType;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    const [expenses, total] = await Promise.all([
      Expense.find(filter).populate('createdBy', 'displayName').sort({ date: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);
    sendSuccess(res, expenses, 'Expenses retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

// Read-only expense view for members (no auth restriction to manager)
export const getMemberExpenses = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { expenseType, month, year } = req.query;
    const filter = {};
    if (expenseType) filter.expenseType = expenseType;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    const [expenses, total] = await Promise.all([
      Expense.find(filter).populate('createdBy', 'displayName').sort({ date: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);
    // Attach summary totals
    const allExpenses = await Expense.find(filter);
    const groceryCost = calculateTotalGroceryCost(allExpenses);
    const commonCost = calculateTotalCommonCost(allExpenses);
    sendSuccess(res, { expenses, groceryCost, commonCost, grandTotal: groceryCost + commonCost }, 'Expenses retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getExpenseSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const match = {};
    if (month) match.month = Number(month);
    if (year) match.year = Number(year);
    const summary = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$expenseType', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    const grandTotal = summary.reduce((acc, s) => acc + s.total, 0);
    sendSuccess(res, { summary, grandTotal }, 'Expense summary retrieved');
  } catch (err) { next(err); }
};

export const createExpense = async (req, res, next) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const expense = await Expense.create({ ...req.body, month, year, createdBy: req.user._id });
    sendSuccess(res, expense, 'Expense added', 201);
  } catch (err) { next(err); }
};

export const updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!expense) return next(notFoundError('Expense'));
    sendSuccess(res, expense, 'Expense updated');
  } catch (err) { next(err); }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return next(notFoundError('Expense'));
    sendSuccess(res, null, 'Expense deleted');
  } catch (err) { next(err); }
};
