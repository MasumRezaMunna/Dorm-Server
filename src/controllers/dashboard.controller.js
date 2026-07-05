import User from '../models/user.model.js';
import Member from '../models/member.model.js';
import Room from '../models/room.model.js';
import Bill from '../models/bill.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Complaint from '../models/complaint.model.js';
import Notice from '../models/notice.model.js';
import MealEntry from '../models/mealEntry.model.js';
import Notification from '../models/notification.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';

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
      pendingBills,
      paidBills,
      recentComplaints,
      recentNotices,
      monthlyIncome,
      monthlyExpenses,
      recentNotifications,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Room.countDocuments(),
      Room.countDocuments({ status: 'occupied' }),
      Bill.countDocuments({ status: { $in: ['pending', 'partial'] } }),
      Bill.countDocuments({ status: 'paid', month, year }),
      Complaint.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName' } }),
      Notice.find({ isPublished: true }).sort({ createdAt: -1 }).limit(3),
      Payment.aggregate([
        { $match: { paidAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { month, year } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    const overview = {
      totalMembers,
      activeMembers,
      totalRooms,
      occupiedRooms,
      availableRooms: totalRooms - occupiedRooms,
      pendingBills,
      paidBills,
      monthlyIncome: monthlyIncome[0]?.total || 0,
      monthlyExpenses: monthlyExpenses[0]?.total || 0,
      netBalance: (monthlyIncome[0]?.total || 0) - (monthlyExpenses[0]?.total || 0),
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

    const [currentBill, recentBills, notices, mealStats, recentNotifications] = await Promise.all([
      Bill.findOne({ memberId: member._id }).sort({ year: -1, month: -1 }),
      Bill.find({ memberId: member._id }).sort({ year: -1, month: -1 }).limit(6),
      Notice.find({ isPublished: true }).sort({ isPinned: -1, createdAt: -1 }).limit(5),
      MealEntry.aggregate([
        { $match: { memberId: member._id, month, year } },
        { $group: { _id: null, total: { $sum: '$mealCount' } } }
      ]),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    const mealThisMonth = mealStats[0]?.total || 0;

    sendSuccess(res, { member, room: member.roomId, currentBill, recentBills, notices, mealThisMonth, recentNotifications }, 'Member dashboard data retrieved');
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
