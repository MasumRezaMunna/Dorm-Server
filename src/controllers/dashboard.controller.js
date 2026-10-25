import User from '../models/user.model.js';
import Member from '../models/member.model.js';
import Room from '../models/room.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Complaint from '../models/complaint.model.js';
import Notice from '../models/notice.model.js';
import MealEntry from '../models/mealEntry.model.js';
import Notification from '../models/notification.model.js';
import MonthlyBalance from '../models/monthlyBalance.model.js';
import { ensureCarryForward, prevMonthYear } from './meal.controller.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import { 
  calculateTotalGroceryCost, 
  calculateTotalCommonCost, 
  calculateTotalExpense, 
  calculateMealRate, 
  calculateCommonCostPerMember,
  roundTwo
} from '../utils/calculations.js';

export const getManagerDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();

    // Ensure carry-forward snapshot is created idempotently for this month
    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    const [
      totalMembers,
      activeMembersList,
      totalRooms,
      occupiedRooms,
      recentComplaints,
      recentNotices,
      paymentAgg,
      expenses,
      recentNotifications,
      totalMealsAgg,
      balanceDocs,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.find({ status: 'active' }).select('_id'),
      Room.countDocuments(),
      Room.countDocuments({ status: 'occupied' }),
      Complaint.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName' } }),
      Notice.find({ isPublished: true }).sort({ createdAt: -1 }).limit(3),
      Payment.aggregate([
        {
          $match: {
            paidAt: {
              $gte: new Date(year, month - 1, 1),
              $lt:  new Date(year, month, 1),
            },
          },
        },
        { $group: { _id: '$memberId', total: { $sum: '$amount' } } },
      ]),
      Expense.find({ month, year }),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      MonthlyBalance.find({ month, year }),
    ]);

    const activeMembers = activeMembersList.length;
    const paymentMap = {};
    paymentAgg.forEach(p => { paymentMap[p._id.toString()] = p.total; });

    const carryMap = new Map(balanceDocs.map(b => [b.memberId.toString(), b.previousBalance]));

    // Total effective paid across all active members (raw payments + carry-forward)
    const totalEffectivePaid = roundTwo(
      activeMembersList.reduce((sum, member) => {
        const mid = member._id.toString();
        const newPayments = paymentMap[mid] || 0;
        const prevBal = carryMap.get(mid) ?? 0;
        return sum + roundTwo(newPayments + prevBal);
      }, 0)
    );

    const rawPaymentsTotal = roundTwo(
      paymentAgg.reduce((sum, p) => sum + (p.total || 0), 0)
    );

    const groceryCost = calculateTotalGroceryCost(expenses);
    const commonCost = calculateTotalCommonCost(expenses);
    const totalExpenses = calculateTotalExpense(groceryCost, commonCost);
    const totalMeals = totalMealsAgg[0]?.total || 0;
    const mealRate = calculateMealRate(groceryCost, totalMeals);
    const commonCostPerMember = calculateCommonCostPerMember(commonCost, activeMembers);

    const overview = {
      totalMembers,
      activeMembers,
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      monthlyIncome: totalEffectivePaid,
      rawMonthlyIncome: rawPaymentsTotal,
      monthlyExpenses: totalExpenses,
      netBalance: roundTwo(totalEffectivePaid - totalExpenses),
      groceryCost,
      commonCost,
      totalMeals,
      mealRate,
      commonCostPerMember
    };

    sendSuccess(res, { overview, recentComplaints, recentNotifications }, 'Manager dashboard data retrieved');
  } catch (err) { next(err); }
};

export const getMemberDashboard = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id }).populate('roomId');
    if (!member) return next(notFoundError('Member profile'));

    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();

    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    const [
      notices,
      mealStats,
      recentNotifications,
      monthlyIncomeAgg,
      expenses,
      activeMembersList,
      totalMealsAgg,
      memberPaymentsAgg,
      balanceDocs,
      myBalanceDoc,
    ] = await Promise.all([
      Notice.find({ isPublished: true }).sort({ isPinned: -1, createdAt: -1 }).limit(5),
      MealEntry.aggregate([
        { $match: { memberId: member._id, month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
      Payment.aggregate([
        { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } },
      ]),
      Expense.find({ month, year }),
      Member.find({ status: 'active' }).select('_id'),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      Payment.aggregate([
        { $match: { memberId: member._id, paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      MonthlyBalance.find({ month, year }),
      MonthlyBalance.findOne({ memberId: member._id, month, year }),
    ]);

    const activeMembersCount = activeMembersList.length;
    const carryMap = new Map(balanceDocs.map(b => [b.memberId.toString(), b.previousBalance]));
    const paymentMap = {};
    monthlyIncomeAgg.forEach(p => { paymentMap[p._id.toString()] = p.totalPaid; });

    const totalEffectiveIncome = roundTwo(
      activeMembersList.reduce((sum, m) => {
        const mid = m._id.toString();
        return sum + roundTwo((paymentMap[mid] || 0) + (carryMap.get(mid) ?? 0));
      }, 0)
    );

    const memberRawPaid = memberPaymentsAgg[0]?.total || 0;
    const memberCarry = myBalanceDoc?.previousBalance ?? 0;
    const memberPaidThisMonth = roundTwo(memberRawPaid + memberCarry);

    const mealThisMonth = mealStats[0]?.total || 0;
    const dormIncome    = totalEffectiveIncome;
    
    const groceryCost = calculateTotalGroceryCost(expenses);
    const commonCost = calculateTotalCommonCost(expenses);
    const dormExpenses = calculateTotalExpense(groceryCost, commonCost);
    
    const dormRemaining = roundTwo(dormIncome - dormExpenses);
    
    const totalMeals = totalMealsAgg[0]?.total || 0;
    const mealRate = calculateMealRate(groceryCost, totalMeals);
    const commonCostPerMember = calculateCommonCostPerMember(commonCost, activeMembersCount);

    sendSuccess(res, { 
      member, 
      room: member.roomId, 
      notices, 
      mealThisMonth, 
      recentNotifications, 
      dormIncome, 
      dormExpenses, 
      dormRemaining,
      groceryCost,
      commonCost,
      totalMeals,
      mealRate,
      commonCostPerMember,
      memberPaidThisMonth,
      previousBalance: memberCarry,
    }, 'Member dashboard data retrieved');
  } catch (err) { next(err); }
};

export const getCommunityStats = async (req, res, next) => {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();

    const { month: prevMonth, year: prevYear } = prevMonthYear(month, year);
    await ensureCarryForward(month, year, prevMonth, prevYear);

    // Get all active members populated with user info and room info
    const [members, mealStats, paymentStats, balanceDocs] = await Promise.all([
      Member.find({ status: 'active' }).populate('userId', 'displayName photoURL email').populate('roomId', 'roomNumber'),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: '$memberId', totalMeals: { $sum: '$mealCount' } } }
      ]),
      Payment.aggregate([
        { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } }
      ]),
      MonthlyBalance.find({ month, year }),
    ]);

    // Map aggregates for quick lookup
    const mealMap = mealStats.reduce((acc, stat) => ({ ...acc, [stat._id.toString()]: stat.totalMeals }), {});
    const paymentMap = paymentStats.reduce((acc, stat) => ({ ...acc, [stat._id.toString()]: stat.totalPaid }), {});
    const carryMap = new Map(balanceDocs.map(b => [b.memberId.toString(), b.previousBalance]));

    // Construct community stats
    const communityData = members.map(m => {
      const mid = m._id.toString();
      const rawPaid = paymentMap[mid] || 0;
      const carry = carryMap.get(mid) ?? 0;
      return {
        memberId: m.memberId,
        name: m.userId?.displayName || 'Unknown',
        photoURL: m.userId?.photoURL || null,
        room: m.roomId,
        totalMeals: mealMap[mid] || 0,
        totalPaid: roundTwo(rawPaid + carry),
        previousBalance: carry,
      };
    });

    // Sort by name
    communityData.sort((a, b) => a.name.localeCompare(b.name));

    sendSuccess(res, communityData, 'Community stats retrieved');
  } catch (err) { next(err); }
};
