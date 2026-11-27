import Notice from '../models/notice.model.js';
import Room from '../models/room.model.js';
import Member from '../models/member.model.js';
import Expense from '../models/expense.model.js';
import MealEntry from '../models/mealEntry.model.js';
import WeeklyMealPlan from '../models/weeklyMealPlan.model.js';
import MonthlyBalance from '../models/monthlyBalance.model.js';
import Settings from '../models/settings.model.js';
import MarketSchedule from '../models/marketSchedule.model.js';
import Payment from '../models/payment.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import {
  calculateTotalGroceryCost,
  calculateTotalCommonCost,
  calculateTotalExpense,
  calculateMealRate,
  calculateCommonCostPerMember,
  roundTwo,
} from '../utils/calculations.js';
import { ensureCarryForward, prevMonthYear } from './meal.controller.js';

// ─── UTC Helper ──────────────────────────────────────────────────────────────
const toUTCMidnight = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

// ─── 1. Public Overview ──────────────────────────────────────────────────────
export const getPublicOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    const [
      totalMembers,
      activeMembersCount,
      totalRooms,
      occupiedRooms,
      expenses,
      totalMealsAgg,
      settingsDoc,
      recentNotices,
      todaySchedule,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Room.countDocuments(),
      Room.countDocuments({ status: 'occupied' }),
      Expense.find({ month, year }),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } },
      ]),
      Settings.findOne(),
      Notice.find({ isPublished: true }).sort({ isPinned: -1, createdAt: -1 }).limit(3),
      (() => {
        const todayUTC    = toUTCMidnight(now);
        const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);
        return MarketSchedule.findOne({
          marketDate: { $gte: todayUTC, $lt: tomorrowUTC },
        });
      })(),
    ]);

    const groceryCost = calculateTotalGroceryCost(expenses);
    const commonCost  = calculateTotalCommonCost(expenses);
    const totalExpenses = calculateTotalExpense(groceryCost, commonCost);
    const totalMeals = totalMealsAgg[0]?.total || 0;
    const mealRate = calculateMealRate(groceryCost, totalMeals);
    const commonCostPerMember = calculateCommonCostPerMember(commonCost, activeMembersCount);

    const overview = {
      dormName: settingsDoc?.dormName || '11/38 Home',
      address: settingsDoc?.address || '',
      managerContact: settingsDoc?.managerContact || '',
      maintenanceContact: settingsDoc?.maintenanceContact || '',
      currency: settingsDoc?.currency || 'BDT',
      currencySymbol: settingsDoc?.currencySymbol || '৳',
      totalMembers,
      activeMembers: activeMembersCount,
      totalRooms,
      occupiedRooms,
      availableRooms: Math.max(0, totalRooms - occupiedRooms),
      totalMeals,
      mealRate: roundTwo(mealRate),
      groceryCost: roundTwo(groceryCost),
      commonCost: roundTwo(commonCost),
      monthlyExpenses: roundTwo(totalExpenses),
      commonCostPerMember: roundTwo(commonCostPerMember),
      month,
      year,
      recentNotices,
      todayMarketTeam: todaySchedule,
    };

    sendSuccess(res, { overview, ...overview }, 'Public overview retrieved');
  } catch (err) {
    next(err);
  }
};

// ─── 2. Public Settings ──────────────────────────────────────────────────────
export const getPublicSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne().select('-updatedBy');
    if (!settings) settings = await Settings.create({});
    sendSuccess(res, settings, 'Dorm settings retrieved');
  } catch (err) {
    next(err);
  }
};

// ─── 3. Public Notices ───────────────────────────────────────────────────────
export const getPublicNotices = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { isPublished: true };
    if (req.query.priority && req.query.priority !== 'all') {
      filter.priority = req.query.priority;
    }

    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .populate('createdBy', 'displayName photoURL')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notice.countDocuments(filter),
    ]);

    sendSuccess(res, notices, 'Notices retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

export const getPublicNoticeById = async (req, res, next) => {
  try {
    const notice = await Notice.findOne({ _id: req.params.id, isPublished: true })
      .populate('createdBy', 'displayName photoURL');
    if (!notice) return next(notFoundError('Notice'));
    sendSuccess(res, notice, 'Notice retrieved');
  } catch (err) {
    next(err);
  }
};

// ─── 4. Public Rooms ─────────────────────────────────────────────────────────
export const getPublicRooms = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, floor } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (floor)  filter.floor  = Number(floor);

    const [rooms, total] = await Promise.all([
      Room.find(filter)
        .populate({
          path: 'members',
          select: 'memberId joinDate userId',
          populate: { path: 'userId', select: 'displayName photoURL' },
        })
        .sort({ roomNumber: 1 })
        .skip(skip)
        .limit(limit),
      Room.countDocuments(filter),
    ]);

    sendSuccess(res, rooms, 'Rooms retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

export const getPublicRoomById = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate({
      path: 'members',
      select: 'memberId joinDate userId',
      populate: { path: 'userId', select: 'displayName photoURL' },
    });
    if (!room) return next(notFoundError('Room'));
    sendSuccess(res, room, 'Room retrieved');
  } catch (err) {
    next(err);
  }
};

// ─── 5. Public Meals ─────────────────────────────────────────────────────────
const getMondayMidnightLocal = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

export const getPublicWeeklyMealPlan = async (req, res, next) => {
  try {
    const weekStart = getMondayMidnightLocal(req.query.date);
    let plan = await WeeklyMealPlan.findOne({ weekStart });

    if (!plan) {
      const previousPlan = await WeeklyMealPlan.findOne({ weekStart: { $lt: weekStart } })
        .sort({ weekStart: -1 });

      const defaultDays = previousPlan
        ? previousPlan.days.map((d) => ({
            dayName: d.dayName,
            lunch: d.lunch,
            dinner: d.dinner,
            lunchNote: d.lunchNote || '',
            dinnerNote: d.dinnerNote || '',
          }))
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
            (dayName) => ({
              dayName,
              lunch: 'Standard Lunch',
              dinner: 'Standard Dinner',
              lunchNote: '',
              dinnerNote: '',
            })
          );

      plan = { weekStart, days: defaultDays };
    }

    sendSuccess(res, plan, 'Weekly meal plan retrieved');
  } catch (err) {
    next(err);
  }
};

export const getPublicMonthlyMealDetail = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    const [mealAgg, expenseAgg, paymentAgg, activeMembers, balanceDocs] = await Promise.all([
      MealEntry.aggregate([
        { $match: { month, year } },
        {
          $group: {
            _id: '$memberId',
            totalLunch:  { $sum: '$lunch' },
            totalDinner: { $sum: '$dinner' },
            totalMeals:  { $sum: '$mealCount' },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { month, year } },
        {
          $group: {
            _id: null,
            totalExpense: { $sum: '$amount' },
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
      Member.find({ status: 'active' })
        .populate('userId', 'displayName photoURL')
        .populate('roomId', 'roomNumber'),
      MonthlyBalance.find({ month, year }),
    ]);

    const totalExpense = expenseAgg[0]?.totalExpense || 0;
    const groceryTotal = expenseAgg[0]?.groceryTotal || 0;
    const commonTotal  = expenseAgg[0]?.commonTotal  || 0;
    const totalMeals   = mealAgg.reduce((s, m) => s + m.totalMeals, 0);

    const settingsDoc  = await Settings.findOne();
    const fallbackRate = settingsDoc?.mealRate || 0;
    const mealRate     = totalMeals > 0 ? groceryTotal / totalMeals : fallbackRate;
    const commonCostPerMember = activeMembers.length > 0
      ? roundTwo(commonTotal / activeMembers.length)
      : 0;

    const mealMap = {};
    mealAgg.forEach((m) => {
      mealMap[m._id.toString()] = m;
    });

    const paymentMap = {};
    paymentAgg.forEach((p) => {
      paymentMap[p._id.toString()] = p.totalPaid;
    });

    const carryMap = new Map(balanceDocs.map((b) => [b.memberId.toString(), b.previousBalance]));

    const membersSummary = activeMembers.map((member) => {
      const mid = member._id.toString();
      const mStats = mealMap[mid] || { totalLunch: 0, totalDinner: 0, totalMeals: 0 };
      const mealCost = roundTwo(mStats.totalMeals * mealRate);
      const commonCost = commonCostPerMember;
      const totalCost = roundTwo(mealCost + commonCost);

      const newPayments = paymentMap[mid] || 0;
      const previousBalance = carryMap.get(mid) ?? 0;
      const paidAmount = roundTwo(newPayments + previousBalance);
      const afterMeal = roundTwo(paidAmount - totalCost);

      return {
        memberId: member.memberId,
        name: member.userId?.displayName || 'Unknown',
        photoURL: member.userId?.photoURL || null,
        roomNumber: member.roomId?.roomNumber || 'N/A',
        totalLunch: mStats.totalLunch,
        totalDinner: mStats.totalDinner,
        totalMeals: mStats.totalMeals,
        mealCost,
        commonCost,
        totalCost,
        paidAmount,
        afterMeal,
        previousBalance,
      };
    });

    // Sort by name
    membersSummary.sort((a, b) => a.name.localeCompare(b.name));

    sendSuccess(
      res,
      {
        month,
        year,
        totalMeals,
        totalExpense: roundTwo(totalExpense),
        groceryTotal: roundTwo(groceryTotal),
        commonTotal: roundTwo(commonTotal),
        mealRate: roundTwo(mealRate),
        commonCostPerMember: roundTwo(commonCostPerMember),
        activeMembersCount: activeMembers.length,
        members: membersSummary,
      },
      'Monthly meal detail retrieved'
    );
  } catch (err) {
    next(err);
  }
};

export const getPublicMealEntries = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { month, year, date } = req.query;
    const filter = {};
    if (month) filter.month = Number(month);
    if (year)  filter.year  = Number(year);
    if (date) {
      const d = new Date(date);
      const nextDate = new Date(d);
      nextDate.setDate(nextDate.getDate() + 1);
      filter.$or = [
        { date: { $gte: d, $lt: nextDate } },
        { date: date },
      ];
    }

    const [entries, total] = await Promise.all([
      MealEntry.find(filter)
        .populate({
          path: 'memberId',
          select: 'memberId userId',
          populate: { path: 'userId', select: 'displayName photoURL' },
        })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      MealEntry.countDocuments(filter),
    ]);

    sendSuccess(res, entries, 'Meal entries retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

// ─── 6. Public Market Schedules ──────────────────────────────────────────────
export const getPublicTodayMarketSchedule = async (req, res, next) => {
  try {
    const todayUTC    = toUTCMidnight(new Date());
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);

    const schedule = await MarketSchedule.findOne({
      marketDate: { $gte: todayUTC, $lt: tomorrowUTC },
    });

    sendSuccess(res, schedule || null, "Today's market schedule retrieved");
  } catch (err) {
    next(err);
  }
};

export const getPublicUpcomingMarketSchedules = async (req, res, next) => {
  try {
    const todayUTC    = toUTCMidnight(new Date());
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);

    const schedules = await MarketSchedule.find({
      marketDate: { $gte: tomorrowUTC },
    })
      .sort({ marketDate: 1 })
      .limit(10);

    sendSuccess(res, schedules, 'Upcoming market schedules retrieved');
  } catch (err) {
    next(err);
  }
};

export const getPublicMarketScheduleHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const todayUTC = toUTCMidnight(new Date());

    const [schedules, total] = await Promise.all([
      MarketSchedule.find({ marketDate: { $lt: todayUTC } })
        .sort({ marketDate: -1 })
        .skip(skip)
        .limit(limit),
      MarketSchedule.countDocuments({ marketDate: { $lt: todayUTC } }),
    ]);

    sendSuccess(res, schedules, 'Market history retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

// ─── 7. Public Expenses ──────────────────────────────────────────────────────
export const getPublicExpenses = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { expenseType, month, year } = req.query;

    const filter = {};
    if (expenseType && expenseType !== 'all') {
      // Handle casing
      const formattedType = expenseType.charAt(0).toUpperCase() + expenseType.slice(1).toLowerCase();
      filter.expenseType = formattedType;
    }
    if (month) filter.month = Number(month);
    if (year)  filter.year  = Number(year);

    const [expenses, total, allExpenses] = await Promise.all([
      Expense.find(filter)
        .populate('createdBy', 'displayName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments(filter),
      Expense.find(filter),
    ]);

    const groceryCost = calculateTotalGroceryCost(allExpenses);
    const commonCost  = calculateTotalCommonCost(allExpenses);
    const grandTotal  = groceryCost + commonCost;

    sendSuccess(
      res,
      {
        expenses,
        groceryCost: roundTwo(groceryCost),
        commonCost: roundTwo(commonCost),
        grandTotal: roundTwo(grandTotal),
      },
      'Public expenses retrieved',
      200,
      buildPagination(page, limit, total)
    );
  } catch (err) {
    next(err);
  }
};

// ─── 8. Public Community Stats ───────────────────────────────────────────────
export const getPublicCommunityStats = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();

    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    const [members, mealStats, paymentStats, balanceDocs, expenseAgg, settingsDoc] = await Promise.all([
      Member.find({ status: 'active' })
        .populate('userId', 'displayName photoURL')
        .populate('roomId', 'roomNumber floor type'),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: '$memberId', totalMeals: { $sum: '$mealCount' } } },
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
      MonthlyBalance.find({ month, year }),
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
      Settings.findOne(),
    ]);

    const groceryTotal = expenseAgg[0]?.groceryTotal || 0;
    const commonTotal  = expenseAgg[0]?.commonTotal  || 0;
    const totalMeals   = mealStats.reduce((s, m) => s + m.totalMeals, 0);
    const fallbackRate = settingsDoc?.mealRate || 0;
    const mealRate     = totalMeals > 0 ? groceryTotal / totalMeals : fallbackRate;
    const commonCostPerMember = members.length > 0 ? roundTwo(commonTotal / members.length) : 0;

    const mealMap    = mealStats.reduce((acc, s) => ({ ...acc, [s._id.toString()]: s.totalMeals }), {});
    const paymentMap = paymentStats.reduce((acc, s) => ({ ...acc, [s._id.toString()]: s.totalPaid }), {});
    const carryMap   = new Map(balanceDocs.map((b) => [b.memberId.toString(), b.previousBalance]));

    const communityData = members.map((m) => {
      const mid = m._id.toString();
      const userMeals = mealMap[mid] || 0;
      const rawPaid   = paymentMap[mid] || 0;
      const carry     = carryMap.get(mid) ?? 0;
      const paidAmount = roundTwo(rawPaid + carry);

      const mealCost  = roundTwo(userMeals * mealRate);
      const totalCost = roundTwo(mealCost + commonCostPerMember);
      const afterMeal = roundTwo(paidAmount - totalCost);

      return {
        memberId: m.memberId,
        name: m.userId?.displayName || 'Unknown',
        photoURL: m.userId?.photoURL || null,
        room: m.roomId,
        joinDate: m.joinDate,
        status: m.status,
        totalMeals: userMeals,
        totalPaid: paidAmount,
        paidAmount,
        mealCost,
        commonCost: commonCostPerMember,
        totalCost,
        afterMeal,
        previousBalance: carry,
      };
    });

    communityData.sort((a, b) => a.name.localeCompare(b.name));

    sendSuccess(res, communityData, 'Public community stats retrieved');
  } catch (err) {
    next(err);
  }
};
