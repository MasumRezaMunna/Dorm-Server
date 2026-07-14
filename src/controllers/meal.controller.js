import MealEntry from '../models/mealEntry.model.js';
import Member from '../models/member.model.js';
import Expense from '../models/expense.model.js';
import Settings from '../models/settings.model.js';
import Payment from '../models/payment.model.js';
import WeeklyMealPlan from '../models/weeklyMealPlan.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';

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
      filter.date = { $gte: d, $lt: next };
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

/**
 * GET /api/meals/monthly-detail?month=7&year=2026
 * Returns:
 *  - per-member meal totals (lunch, dinner, total)
 *  - total grocery/meal expenses for the month
 *  - computed meal rate = total grocery expense / total meals
 *  - per-member meal cost = their meals × meal rate
 *  - per-member balance from bills (paidAmount - totalAmount)
 *  - per-member balance remaining after meal deduction
 */
export const getMonthlyDetail = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    // 1. Per-member meal aggregation
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

    // 2. Total grocery and common expenses this month
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
    const totalExpense  = expenseAgg[0]?.totalExpense  || 0;
    const groceryTotal  = expenseAgg[0]?.groceryTotal  || 0;
    const commonTotal   = expenseAgg[0]?.commonTotal   || 0;

    // 3. Total meals across all members
    const totalMeals = mealAgg.reduce((s, m) => s + m.totalMeals, 0);

    // 4. Meal rate: grocery-only expenses ÷ total meals
    const settings = await Settings.findOne();
    const fallbackRate = settings?.mealRate || 0;
    const mealRate = totalMeals > 0 ? groceryTotal / totalMeals : fallbackRate;

    // 4b. Common cost per member (split equally among active members)
    const activeMembersCount = await Member.countDocuments({ status: 'active' });
    const commonCostPerMember = activeMembersCount > 0 ? Math.round((commonTotal / activeMembersCount) * 100) / 100 : 0;

    // 5. Aggregate total paid per member from Payment records for this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1); // exclusive upper bound
    const paymentAgg = await Payment.aggregate([
      { $match: { paidAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } },
    ]);

    // 6. All active members
    const allMembers = await Member.find({ status: 'active' }).populate('userId', 'displayName email photoURL');

    // 7. Build per-member summary
    const mealMap = {};
    mealAgg.forEach(m => { mealMap[m._id.toString()] = m; });

    const paymentMap = {};
    paymentAgg.forEach(p => { paymentMap[p._id.toString()] = p.totalPaid; });

    const members = allMembers.map(member => {
      const mid    = member._id.toString();
      const meals  = mealMap[mid] || { totalLunch: 0, totalDinner: 0, totalMeals: 0 };
      const mealCost    = Math.round(meals.totalMeals * mealRate * 100) / 100;
      const totalCost   = Math.round((mealCost + commonCostPerMember) * 100) / 100;
      const paidAmount  = paymentMap[mid] || 0;            // sum of all payments this month
      const afterMeal   = paidAmount - totalCost;          // remaining after meal + common deduction

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
        commonCostPerMember,
        totalCost,
        paidAmount,
        afterMeal,
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
      mealRate: Math.round(mealRate * 100) / 100,
      members,
    }, 'Monthly meal detail retrieved');
  } catch (err) { next(err); }
};

export const createMealEntry = async (req, res, next) => {
  try {
    const date = new Date(req.body.date || Date.now());
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const entry = await MealEntry.create({ ...req.body, month, year, addedBy: req.user._id });
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
      const date = new Date(entry.date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const lunch  = entry.lunch  !== undefined ? Number(entry.lunch)  : (entry.mealCount ?? 0);
      const dinner = entry.dinner !== undefined ? Number(entry.dinner) : 0;

      return {
        updateOne: {
          filter: { memberId: entry.member, date: entry.date },
          update: {
            $set: {
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
      const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(dayName => ({
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
