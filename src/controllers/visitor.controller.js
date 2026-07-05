import Visitor from '../models/visitor.model.js';
import Member from '../models/member.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';

export const getVisitors = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const [visitors, total] = await Promise.all([
      Visitor.find(filter).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName' } }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Visitor.countDocuments(filter),
    ]);
    sendSuccess(res, visitors, 'Visitors retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const logVisitor = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id });
    const memberId = req.user.role === 'manager' ? req.body.memberId : member?._id;
    const visitor = await Visitor.create({ ...req.body, memberId });
    sendSuccess(res, visitor, 'Visitor logged', 201);
  } catch (err) { next(err); }
};

export const updateVisitor = async (req, res, next) => {
  try {
    const visitor = await Visitor.findByIdAndUpdate(req.params.id, { ...req.body, approvedBy: req.user._id }, { new: true });
    if (!visitor) return next(notFoundError('Visitor'));
    sendSuccess(res, visitor, 'Visitor updated');
  } catch (err) { next(err); }
};

export const checkOutVisitor = async (req, res, next) => {
  try {
    const visitor = await Visitor.findByIdAndUpdate(req.params.id, { checkOut: new Date(), status: 'checked-out' }, { new: true });
    if (!visitor) return next(notFoundError('Visitor'));
    sendSuccess(res, visitor, 'Visitor checked out');
  } catch (err) { next(err); }
};
