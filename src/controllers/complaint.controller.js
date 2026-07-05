import Complaint from '../models/complaint.model.js';
import Member from '../models/member.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import User from '../models/user.model.js';
import { createNotification } from './notification.controller.js';

export const getComplaints = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    const [complaints, total] = await Promise.all([
      Complaint.find(filter).populate({ path: 'memberId', populate: { path: 'userId', select: 'displayName photoURL' } }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Complaint.countDocuments(filter),
    ]);
    sendSuccess(res, complaints, 'Complaints retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getMyComplaints = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id });
    if (!member) return next(notFoundError('Member profile'));
    const complaints = await Complaint.find({ memberId: member._id }).sort({ createdAt: -1 });
    sendSuccess(res, complaints, 'Complaints retrieved');
  } catch (err) { next(err); }
};

export const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate('memberId resolvedBy');
    if (!complaint) return next(notFoundError('Complaint'));
    sendSuccess(res, complaint, 'Complaint retrieved');
  } catch (err) { next(err); }
};

export const createComplaint = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user._id });
    if (!member) return next(notFoundError('Member profile — you must be a registered member to submit complaints'));
    const complaint = await Complaint.create({ ...req.body, memberId: member._id });
    
    // Notify all managers
    const managers = await User.find({ role: 'manager' });
    managers.forEach(mgr => {
      createNotification(mgr._id, 'New Complaint Submitted', `${member.userId.displayName || 'A member'} submitted a new complaint`, 'complaint', '/manager/complaints');
    });
    
    sendSuccess(res, complaint, 'Complaint submitted', 201);
  } catch (err) { next(err); }
};

export const updateComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!complaint) return next(notFoundError('Complaint'));
    sendSuccess(res, complaint, 'Complaint updated');
  } catch (err) { next(err); }
};

export const resolveComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', response: req.body.response, resolvedBy: req.user._id, resolvedAt: new Date() },
      { new: true }
    );
    if (!complaint) return next(notFoundError('Complaint'));
    
    const member = await Member.findById(complaint.memberId);
    if (member) {
      createNotification(member.userId, 'Complaint Resolved', `Your complaint has been resolved by a manager`, 'complaint', '/member/complaints');
    }
    
    sendSuccess(res, complaint, 'Complaint resolved');
  } catch (err) { next(err); }
};

export const deleteComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) return next(notFoundError('Complaint'));
    sendSuccess(res, null, 'Complaint deleted');
  } catch (err) { next(err); }
};
