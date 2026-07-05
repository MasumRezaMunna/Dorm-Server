import Payment from '../models/payment.model.js';
import Bill from '../models/bill.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, AppError } from '../utils/AppError.js';
import Member from '../models/member.model.js';
import { createNotification } from './notification.controller.js';

export const getPayments = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { memberId, billId } = req.query;
    const filter = {};
    if (memberId) filter.memberId = memberId;
    if (billId) filter.billId = billId;
    const [payments, total] = await Promise.all([
      Payment.find(filter).populate('memberId billId receivedBy').sort({ paidAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter),
    ]);
    sendSuccess(res, payments, 'Payments retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const createPayment = async (req, res, next) => {
  try {
    const { billId, amount } = req.body;
    const bill = await Bill.findById(billId);
    if (!bill) return next(notFoundError('Bill'));
    const overpay = bill.paidAmount + amount > bill.totalAmount;
    if (overpay) return next(new AppError(`Payment exceeds outstanding balance of ৳${bill.totalAmount - bill.paidAmount}`, 400));
    const payment = await Payment.create({ ...req.body, receivedBy: req.user._id });
    // Update bill paid amount
    bill.paidAmount += amount;
    await bill.save(); // triggers status update via pre-save hook
    
    const member = await Member.findById(payment.memberId || bill.memberId);
    if (member) {
      createNotification(member.userId, 'Payment Received', `Payment of ৳${amount} recorded for your bill`, 'payment', '/member/bills');
    }
    
    sendSuccess(res, payment, 'Payment recorded', 201);
  } catch (err) { next(err); }
};

export const getPaymentsByBill = async (req, res, next) => {
  try {
    const payments = await Payment.find({ billId: req.params.billId }).populate('receivedBy', 'displayName').sort({ paidAt: -1 });
    sendSuccess(res, payments, 'Payments retrieved');
  } catch (err) { next(err); }
};

export const updatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(notFoundError('Payment'));

    const bill = await Bill.findById(payment.billId);
    if (!bill) return next(notFoundError('Bill'));

    const { amount, method, transactionId, note } = req.body;
    
    if (amount !== undefined && amount !== payment.amount) {
      const difference = amount - payment.amount;
      const overpay = bill.paidAmount + difference > bill.totalAmount;
      if (overpay) return next(new AppError(`Updated payment exceeds outstanding balance`, 400));
      
      bill.paidAmount += difference;
      await bill.save();
    }

    if (amount !== undefined) payment.amount = amount;
    if (method) payment.method = method;
    if (transactionId !== undefined) payment.transactionId = transactionId;
    if (note !== undefined) payment.note = note;
    
    await payment.save();
    sendSuccess(res, payment, 'Payment updated');
  } catch (err) { next(err); }
};

export const deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(notFoundError('Payment'));

    const bill = await Bill.findById(payment.billId);
    if (bill) {
      bill.paidAmount -= payment.amount;
      await bill.save();
    }
    
    await Payment.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Payment deleted');
  } catch (err) { next(err); }
};
