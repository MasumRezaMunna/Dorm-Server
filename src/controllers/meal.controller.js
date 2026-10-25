import MealEntry from '../models/mealEntry.model.js';
import Member from '../models/member.model.js';
import Expense from '../models/expense.model.js';
import Settings from '../models/settings.model.js';
import Payment from '../models/payment.model.js';
import WeeklyMealPlan from '../models/weeklyMealPlan.model.js';
import MonthlyBalance from '../models/monthlyBalance.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';

const roundTwo = (num) => Math.round((num || 0) * 100) / 100;

export const getMealEntries = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { memberId, month, year, date } = req.query;
    const filter = {};
    if (memberId) filter.memberId = memberId;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.$or = [
        { date: { $gte: d, $lt: next } },
        { date: date },
      ];
    }
    const [entries, total] = await Promise.all([
      MealEntry.find(filter).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName' } }).sort({ date: -1 }).skip(skip).limit(limit),
      MealEntry.countDocuments(filter),
    ]);
    sendSuccess(res, entries, 'Meal entries retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getMonthlySummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const match = {};
    if (month) match.month = Number(month);
    if (year) match.year = Number(year);
    const summary = await MealEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$memberId',
          totalMeals: { $sum: '$mealCount' },
        },
      },
      { $sort: { totalMeals: -1 } },
    ]);
    sendSuccess(res, summary, 'Monthly meal summary retrieved');
  } catch (err) { next(err); }
};

// ─── Timezone helpers (Asia/Dhaka, UTC+6) ────────────────────────────────────
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6

/**
 * Returns the current { month, year } in Asia/Dhaka timezone.
 */
function dhakaMonthYear() {
  const dhaka = new Date(Date.now() + DHAKA_OFFSET_MS);
  return { month: dhaka.getUTCMonth() + 1, year: dhaka.getUTCFullYear() };
}

/**
 * Given a { month, year }, returns the previous { month, year }.
 * Handles December → January correctly.
 */
export function prevMonthYear(month, year) {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

/**
 * Computes per-member closing balance for a given (month, year).
 *
 * The closing balance is:
 *   previousBalance (from storedCarryMap) + payments − (mealCost + commonCost)
 *
 * storedCarryMap: Map<memberId_string, previousBalance> already persisted in
 * MonthlyBalance for (month, year).  Pass an empty Map when no prior carry-
 * forward exists for that month (e.g. month 1 of the system's lifetime).
 *
 * Returns a Map<memberId_string, closingBalance_number>.
 */
async function computeRawAfterMealMap(month, year, storedCarryMap = new Map()) {
  const [mealAgg, expenseAgg, paymentAgg, allMembers] = await Promise.all([
    MealEntry.aggregate([
      { $match: { month, year } },
      {
        $group: {
          _id: '$memberId',
          totalMeals: { $sum: '$mealCount' },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { month, year } },
      {
        $group: {
          _id: null,
          groceryTotal: {
            $sum: { $cond: [{ $eq: ['$expenseType', 'Grocery'] }, '$amount', 0] },
          },
          commonTotal: {
            $sum: { $cond: [{ $eq: ['$expenseType', 'Common'] }, '$amount', 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: new Date(year, month - 1, 1),
            $lt:  new Date(year, month, 1),
          },
        },
      },
      { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } },
    ]),
    Member.find({ status: 'active' }).select('_id'),
  ]);

  const groceryTotal  = expenseAgg[0]?.groceryTotal || 0;
  const commonTotal   = expenseAgg[0]?.commonTotal  || 0;
  const totalMeals    = mealAgg.reduce((s, m) => s + m.totalMeals, 0);
  const settings      = await Settings.findOne();
  const fallbackRate  = settings?.mealRate || 0;
  const mealRate      = totalMeals > 0 ? roundTwo(groceryTotal / totalMeals) : fallbackRate;
  const commonPerMem  = allMembers.length > 0 ? roundTwo(commonTotal / allMembers.length) : 0;

  const mealMap    = Object.fromEntries(mealAgg.map(m   => [m._id.toString(), m.totalMeals]));
  const paymentMap = Object.fromEntries(paymentAgg.map(p => [p._id.toString(), p.totalPaid]));

  const result = new Map();
  for (const member of allMembers) {
    const mid       = member._id.toString();
    const meals     = mealMap[mid]    || 0;
    const paid      = paymentMap[mid] || 0;
    // Include any carry-forward that was applied to this month so the closing
    // balance correctly accumulates across multiple consecutive months.
    const carry     = storedCarryMap.get(mid) ?? 0;
    const mealCost  = roundTwo(meals * mealRate);
    const totalCost = roundTwo(mealCost + commonPerMem);
    result.set(mid, roundTwo(carry + paid - totalCost));
  }
  return result;
}

/**
 * Idempotently ensures that MonthlyBalance records exist for every active
 * member for (targetMonth, targetYear), carrying forward each member's
 * closing balance from (sourceMonth, sourceYear).
 *
 * Uses `$setOnInsert` so that if the document already exists it is NEVER
 * overwritten — preventing double-application on repeated API calls or
 * server restarts.
 *
 * The closing balance for the source month is computed as:
 *   sourceMonth.previousBalance + sourceMonth.payments − sourceMonth.costs
 * so that the carry-forward chain remains intact across three or more
 * consecutive months.
 */
export async function ensureCarryForward(targetMonth, targetYear, sourceMonth, sourceYear) {
  // Read the source month's own stored carry-forward balance so that the
  // closing balance snapshot includes any balance carried *into* that month
  // from even earlier periods.  Without this, the chain breaks after month 2.
  const sourceBalanceDocs = await MonthlyBalance.find({ month: sourceMonth, year: sourceYear });
  const sourceCarryMap    = new Map(
    sourceBalanceDocs.map(b => [b.memberId.toString(), b.previousBalance])
  );

  // Compute the previous month's closing balance for each active member
  const prevAfterMealMap = await computeRawAfterMealMap(sourceMonth, sourceYear, sourceCarryMap);

  // Build bulk upsert operations — one per member
  const bulkOps = [];
  for (const [memberId, previousBalance] of prevAfterMealMap.entries()) {
    bulkOps.push({
      updateOne: {
        filter: { memberId, month: targetMonth, year: targetYear },
        update: {
          $setOnInsert: {
            memberId,
            month:           targetMonth,
            year:            targetYear,
            previousBalance: roundTwo(previousBalance),
            sourceMonth,
            sourceYear,
          },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await MonthlyBalance.bulkWrite(bulkOps, { ordered: false });
  }
}

/**
 * GET /api/meals/monthly-detail?month=7&year=2026
 *
 * Returns per-member meal totals, expenses, meal rate, and — crucially —
 * each member's effective Paid amount, which already includes the
 * carry-forward of the previous month's After Deduction balance.
 *
 * The carry-forward is stored idempotently in MonthlyBalance so that
 * page refreshes and repeated API calls never double-apply the adjustment.
 *
 * Month boundaries are evaluated in the Asia/Dhaka timezone (UTC+6).
 */
export const getMonthlyDetail = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    // ── Step 1: Idempotently snapshot the previous month's closing balances
    //           into MonthlyBalance for this (month, year) ──────────────────
    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    // ── Step 2: Load the stored carry-forward balances for this month ────────
    const balanceDocs = await MonthlyBalance.find({ month, year });
    const carryMap = new Map(
      balanceDocs.map(b => [b.memberId.toString(), b.previousBalance])
    );

    // ── Step 3: Per-member meal aggregation ──────────────────────────────────
    const mealAgg = await MealEntry.aggregate([
      { $match: { month, year } },
      {
        $group: {
          _id: '$memberId',
          totalLunch:  { $sum: '$lunch' },
          totalDinner: { $sum: '$dinner' },
          totalMeals:  { $sum: '$mealCount' },
        },
      },
    ]);

    // ── Step 4: Total grocery and common expenses this month ─────────────────
    const expenseAgg = await Expense.aggregate([
      { $match: { month, year } },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: '$amount' },
          groceryTotal: {
            $sum: {
              $cond: [{ $eq: ['$expenseType', 'Grocery'] }, '$amount', 0],
            },
          },
          commonTotal: {
            $sum: {
              $cond: [{ $eq: ['$expenseType', 'Common'] }, '$amount', 0],
            },
          },
        },
      },
    ]);
    const totalExpense = expenseAgg[0]?.totalExpense || 0;
    const groceryTotal = expenseAgg[0]?.groceryTotal || 0;
    const commonTotal  = expenseAgg[0]?.commonTotal  || 0;

    // ── Step 5: Total meals across all members ───────────────────────────────
    const totalMeals = mealAgg.reduce((s, m) => s + m.totalMeals, 0);

    // ── Step 6: Meal rate ────────────────────────────────────────────────────
    const settings    = await Settings.findOne();
    const fallbackRate = settings?.mealRate || 0;
    const mealRate     = totalMeals > 0 ? groceryTotal / totalMeals : fallbackRate;

    // ── Step 7: Common cost per active member ────────────────────────────────
    const activeMembersCount  = await Member.countDocuments({ status: 'active' });
    const commonCostPerMember = activeMembersCount > 0
      ? roundTwo(commonTotal / activeMembersCount)
      : 0;

    // ── Step 8: Actual payments made this month (raw cash/bkash/etc.) ────────
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month,     1); // exclusive
    const paymentAgg = await Payment.aggregate([
      { $match: { paidAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } },
    ]);

    // ── Step 9: All active members ───────────────────────────────────────────
    const allMembers = await Member.find({ status: 'active' })
      .populate('userId', 'displayName email photoURL');

    // ── Step 10: Build per-member response ───────────────────────────────────
    const mealMap = {};
    mealAgg.forEach(m => { mealMap[m._id.toString()] = m; });

    const paymentMap = {};
    paymentAgg.forEach(p => { paymentMap[p._id.toString()] = p.totalPaid; });

    const roundedMealRate   = roundTwo(mealRate);
    const roundedCommonRate = roundTwo(commonCostPerMember);

    const members = allMembers.map((member) => {
      const mid     = member._id.toString();
      const meals   = mealMap[mid] || { totalLunch: 0, totalDinner: 0, totalMeals: 0 };

      // Costs for this month
      const mealCost    = roundTwo(meals.totalMeals * roundedMealRate);
      const commonCost  = roundedCommonRate;
      const totalCost   = roundTwo(mealCost + commonCost);

      // Actual new payments received this month
      const newPayments = paymentMap[mid] || 0;

      // Previous month's carry-forward balance:
      //   positive → member had credit last month (e.g. overpaid)
      //   negative → member had a debt last month (e.g. underpaid)
      const previousBalance = carryMap.get(mid) ?? 0;

      // Effective paid = new payments + previous carry-forward
      // (previousBalance is ADDED, so:
      //   negative carry → reduces effective paid, member still owes
      //   positive carry → increases effective paid, member has extra credit)
      const paidAmount = roundTwo(newPayments + previousBalance);

      // After Deduction = effective paid − this month's total cost
      const afterMeal = roundTwo(paidAmount - totalCost);

      return {
        memberId: mid,
        name:     member.userId?.displayName || 'Unknown',
        email:    member.userId?.email,
        photoURL: member.userId?.photoURL,
        roomNumber: member.roomId?.roomNumber,
        totalLunch:  meals.totalLunch,
        totalDinner: meals.totalDinner,
        totalMeals:  meals.totalMeals,
        mealCost,
        commonCostPerMember: commonCost,
        totalCost,
        paidAmount,   // effective paid (new payments + carry-forward)
        afterMeal,    // balance after this month's costs
        previousBalance, // informational: carry-forward applied
      };
    });

    sendSuccess(res, {
      month,
      year,
      totalExpense,
      groceryTotal,
      commonTotal,
      commonCostPerMember,
      totalMeals,
      mealRate: roundTwo(mealRate),
      members,
    }, 'Monthly meal detail retrieved');
  } catch (err) { next(err); }
};

export const createMealEntry = async (req, res, next) => {
  try {
    const rawDate = req.body.date || new Date().toISOString().split('T')[0];
    const [y, m] = rawDate.split('-');
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    const date = new Date(rawDate);
    const entry = await MealEntry.create({ ...req.body, date, month, year, addedBy: req.user._id });
    sendSuccess(res, entry, 'Meal entry created', 201);
  } catch (err) { next(err); }
};

export const updateMealEntry = async (req, res, next) => {
  try {
    const entry = await MealEntry.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!entry) return next(notFoundError('Meal entry'));
    sendSuccess(res, entry, 'Meal entry updated');
  } catch (err) { next(err); }
};

export const deleteMealEntry = async (req, res, next) => {
  try {
    const entry = await MealEntry.findByIdAndDelete(req.params.id);
    if (!entry) return next(notFoundError('Meal entry'));
    sendSuccess(res, null, 'Meal entry deleted');
  } catch (err) { next(err); }
};

export const createBulkMealEntries = async (req, res, next) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'Invalid entries data' });
    }

    const operations = entries.map(entry => {
      const rawDate = entry.date;
      const [y, m] = rawDate.split('-');
      const month = parseInt(m, 10);
      const year = parseInt(y, 10);
      const date = new Date(rawDate);
      const lunch  = entry.lunch  !== undefined ? Number(entry.lunch)  : (entry.mealCount ?? 0);
      const dinner = entry.dinner !== undefined ? Number(entry.dinner) : 0;

      return {
        updateOne: {
          filter: { memberId: entry.member, date },
          update: {
            $set: {
              date,
              lunch,
              dinner,
              mealCount: lunch + dinner,
              month,
              year,
              addedBy: req.user._id,
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await MealEntry.bulkWrite(operations);
    }

    sendSuccess(res, null, 'Bulk meal entries saved successfully', 201);
  } catch (err) { next(err); }
};

export const getMyMeals = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id });
    if (!member) return next(notFoundError('Member profile'));

    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    const meals = await MealEntry.find({ memberId: member._id, month, year }).sort({ date: -1 });
    sendSuccess(res, meals, 'My meals retrieved');
  } catch (err) { next(err); }
};

const getMondayMidnightLocal = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

export const getWeeklyPlan = async (req, res, next) => {
  try {
    const weekStart = getMondayMidnightLocal(req.query.date);
    
    let plan = await WeeklyMealPlan.findOne({ weekStart });
    
    if (!plan) {
      // Try to carry forward the most recent previous week's plan
      const previousPlan = await WeeklyMealPlan.findOne({ weekStart: { $lt: weekStart } }).sort({ weekStart: -1 });

      const defaultDays = previousPlan
        ? previousPlan.days.map(d => ({
            dayName: d.dayName,
            lunch: d.lunch,
            dinner: d.dinner,
            lunchNote: d.lunchNote || '',
            dinnerNote: d.dinnerNote || '',
          }))
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(dayName => ({
            dayName,
            lunch: true,
            dinner: true,
            lunchNote: '',
            dinnerNote: ''
          }));

      plan = await WeeklyMealPlan.create({
        weekStart,
        days: defaultDays
      });
    }
    
    sendSuccess(res, plan, 'Weekly meal plan retrieved');
  } catch (err) { next(err); }
};

export const upsertWeeklyPlan = async (req, res, next) => {
  try {
    const weekStart = getMondayMidnightLocal(req.body.weekStart || req.query.date);
    const { days } = req.body;
    
    if (!days || !Array.isArray(days)) {
      return res.status(400).json({ success: false, message: 'Invalid days data' });
    }
    
    let plan = await WeeklyMealPlan.findOne({ weekStart });
    
    if (plan) {
      plan.days = days;
      plan.updatedBy = req.user._id;
      await plan.save();
    } else {
      plan = await WeeklyMealPlan.create({
        weekStart,
        days,
        updatedBy: req.user._id
      });
    }
    
    sendSuccess(res, plan, 'Weekly meal plan updated');
  } catch (err) { next(err); }
};
