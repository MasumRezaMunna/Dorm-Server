import User from '../models/user.model.js';
import Member from '../models/member.model.js';
import Room from '../models/room.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Complaint from '../models/complaint.model.js';
import Notice from '../models/notice.model.js';
import MealEntry from '../models/mealEntry.model.js';
import Notification from '../models/notification.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import { 
  calculateTotalGroceryCost, 
  calculateTotalCommonCost, 
  calculateTotalExpense, 
  calculateMealRate, 
  calculateCommonCostPerMember 
} from '../utils/calculations.js';

export const getManagerDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [
      totalMembers,
      activeMembers,
      totalRooms,
      occupiedRooms,
      recentComplaints,
      recentNotices,
      monthlyIncome,
      expenses,
      recentNotifications,
      totalMealsAgg,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Room.countDocuments(),
      Room.countDocuments({ status: 'occupied' }),
      Complaint.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName' } }),
      Notice.find({ isPublished: true }).sort({ createdAt: -1 }).limit(3),
      Payment.aggregate([
        { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.find({ month, year }),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
    ]);

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
      monthlyIncome: monthlyIncome[0]?.total || 0,
      monthlyExpenses: totalExpenses,
      netBalance: (monthlyIncome[0]?.total || 0) - totalExpenses,
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
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [notices, mealStats, recentNotifications, monthlyIncomeAgg, expenses, activeMembersCount, totalMealsAgg, memberPaymentsAgg] = await Promise.all([
      Notice.find({ isPublished: true }).sort({ isPinned: -1, createdAt: -1 }).limit(5),
      MealEntry.aggregate([
        { $match: { memberId: member._id, month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
      Payment.aggregate([
        { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.find({ month, year }),
      Member.countDocuments({ status: 'active' }),
      MealEntry.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      Payment.aggregate([
        { $match: { memberId: member._id, paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
    ]);

    const mealThisMonth = mealStats[0]?.total || 0;
    const dormIncome    = monthlyIncomeAgg[0]?.total   || 0;
    const memberPaidThisMonth = memberPaymentsAgg[0]?.total || 0;
    
    const groceryCost = calculateTotalGroceryCost(expenses);
    const commonCost = calculateTotalCommonCost(expenses);
    const dormExpenses = calculateTotalExpense(groceryCost, commonCost);
    
    const dormRemaining = dormIncome - dormExpenses;
    
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
      memberPaidThisMonth
    }, 'Member dashboard data retrieved');
  } catch (err) { next(err); }
};

export const getCommunityStats = async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get all active members populated with user info and room info
    const members = await Member.find({ status: 'active' }).populate('userId', 'displayName photoURL email').populate('roomId', 'roomNumber');

    // Get meal stats for the month
    const mealStats = await MealEntry.aggregate([
      { $match: { month, year } },
      { $group: { _id: '$memberId', totalMeals: { $sum: '$mealCount' } } }
    ]);

    // Get payment stats for the month (total paid by member this month)
    const paymentStats = await Payment.aggregate([
      { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
      { $group: { _id: '$memberId', totalPaid: { $sum: '$amount' } } }
    ]);

    // Map aggregates for quick lookup
    const mealMap = mealStats.reduce((acc, stat) => ({ ...acc, [stat._id.toString()]: stat.totalMeals }), {});
    const paymentMap = paymentStats.reduce((acc, stat) => ({ ...acc, [stat._id.toString()]: stat.totalPaid }), {});

    // Construct community stats
    const communityData = members.map(m => ({
      memberId: m.memberId,
      name: m.userId?.displayName || 'Unknown',
      photoURL: m.userId?.photoURL || null,
      room: m.roomId, // Or could populate Room
      totalMeals: mealMap[m._id.toString()] || 0,
      totalPaid: paymentMap[m._id.toString()] || 0,
    }));

    // Sort by name
    communityData.sort((a, b) => a.name.localeCompare(b.name));

    sendSuccess(res, communityData, 'Community stats retrieved');
  } catch (err) { next(err); }
};
