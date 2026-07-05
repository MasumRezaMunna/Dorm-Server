import Bill from '../models/bill.model.js';
import Member from '../models/member.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, conflictError } from '../utils/AppError.js';
import { createNotification } from './notification.controller.js';

export const getBills = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, month, year, memberId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (memberId) filter.memberId = memberId;
    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .populate({
          path: 'memberId',
          populate: [
            { path: 'userId', select: 'displayName email' },
            { path: 'roomId', select: 'roomNumber' }
          ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bill.countDocuments(filter),
    ]);
    sendSuccess(res, bills, 'Bills retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getMyBills = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id });
    if (!member) return next(notFoundError('Member profile'));
    const { page, limit, skip } = parsePagination(req.query);
    const [bills, total] = await Promise.all([
      Bill.find({ memberId: member._id }).sort({ year: -1, month: -1 }).skip(skip).limit(limit),
      Bill.countDocuments({ memberId: member._id }),
    ]);
    sendSuccess(res, bills, 'Bills retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getBillById = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('memberId generatedBy');
    if (!bill) return next(notFoundError('Bill'));
    sendSuccess(res, bill, 'Bill retrieved');
  } catch (err) { next(err); }
};

export const createBill = async (req, res, next) => {
  try {
    const { memberId, month, year } = req.body;
    const exists = await Bill.findOne({ memberId, month, year });
    if (exists) return next(conflictError(`Bill for month ${month}/${year} already exists for this member`));
    const { rent = 0, electricity = 0, wifi = 0, water = 0, gas = 0, mealCost = 0, otherCharges = 0 } = req.body;
    const totalAmount = rent + electricity + wifi + water + gas + mealCost + otherCharges;
    const bill = await Bill.create({ ...req.body, totalAmount, generatedBy: req.user._id });
    
    const member = await Member.findById(memberId);
    if (member) {
      createNotification(member.userId, 'New Bill Generated', `Your bill for ${month}/${year} has been generated. Total: ৳${totalAmount}`, 'bill', '/member/bills');
    }
    
    sendSuccess(res, bill, 'Bill created', 201);
  } catch (err) { next(err); }
};

export const createBulkBills = async (req, res, next) => {
  try {
    const { month, year, rent = 0, mealCost = 0, electricity = 0, wifi = 0, water = 0, gas = 0, dueDate } = req.body;
    
    // Get all active members
    const members = await Member.find({ status: 'active' });
    if (!members.length) return next(conflictError('No active members found'));

    // Find existing bills for this month
    const existingBills = await Bill.find({ month, year });
    const existingMemberIds = existingBills.map(b => b.memberId.toString());

    // Filter out members who already have bills
    const newMembers = members.filter(m => !existingMemberIds.includes(m._id.toString()));
    if (!newMembers.length) return next(conflictError(`Bills for all active members for ${month}/${year} already exist`));

    const totalAmount = rent + electricity + wifi + water + gas + mealCost;

    const billsData = newMembers.map(m => ({
      memberId: m._id,
      month,
      year,
      rent,
      mealCost,
      electricity,
      wifi,
      water,
      gas,
      totalAmount,
      dueDate,
      generatedBy: req.user._id
    }));

    const bills = await Bill.insertMany(billsData);
    
    newMembers.forEach(m => {
      createNotification(m.userId, 'New Bill Generated', `Your bill for ${month}/${year} has been generated. Total: ৳${totalAmount}`, 'bill', '/member/bills');
    });

    sendSuccess(res, bills, `Successfully generated ${bills.length} bills`, 201);
  } catch (err) { next(err); }
};

export const updateBill = async (req, res, next) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bill) return next(notFoundError('Bill'));
    sendSuccess(res, bill, 'Bill updated');
  } catch (err) { next(err); }
};

export const deleteBill = async (req, res, next) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return next(notFoundError('Bill'));
    sendSuccess(res, null, 'Bill deleted');
  } catch (err) { next(err); }
};
