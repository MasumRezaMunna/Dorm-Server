import Notice from '../models/notice.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import Member from '../models/member.model.js';
import { createNotification } from './notification.controller.js';

export const getNotices = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { isPublished: true };
    const [notices, total] = await Promise.all([
      Notice.find(filter).populate('createdBy', 'displayName photoURL').sort({ isPinned: -1, createdAt: -1 }).skip(skip).limit(limit),
      Notice.countDocuments(filter),
    ]);
    sendSuccess(res, notices, 'Notices retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getNoticeById = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id).populate('createdBy', 'displayName');
    if (!notice) return next(notFoundError('Notice'));
    sendSuccess(res, notice, 'Notice retrieved');
  } catch (err) { next(err); }
};

export const createNotice = async (req, res, next) => {
  try {
    const notice = await Notice.create({ ...req.body, createdBy: req.user._id });
    
    if (notice.isPublished) {
      const activeMembers = await Member.find({ status: 'active' });
      activeMembers.forEach(m => {
        createNotification(m.userId, 'New Notice Published', notice.title, 'notice', '/member/notices');
      });
    }

    sendSuccess(res, notice, 'Notice created', 201);
  } catch (err) { next(err); }
};

export const updateNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!notice) return next(notFoundError('Notice'));
    sendSuccess(res, notice, 'Notice updated');
  } catch (err) { next(err); }
};

export const deleteNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return next(notFoundError('Notice'));
    sendSuccess(res, null, 'Notice deleted');
  } catch (err) { next(err); }
};

export const togglePin = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return next(notFoundError('Notice'));
    notice.isPinned = !notice.isPinned;
    await notice.save();
    sendSuccess(res, notice, `Notice ${notice.isPinned ? 'pinned' : 'unpinned'}`);
  } catch (err) { next(err); }
};
