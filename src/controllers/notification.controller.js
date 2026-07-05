import Notification from '../models/notification.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, forbiddenError } from '../utils/AppError.js';

export const createNotification = async (userId, title, message, type, link = null, metadata = {}) => {
  try {
    await Notification.create({ userId, title, message, type, link, metadata });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { userId: req.user._id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);
    sendSuccess(res, { notifications, unreadCount }, 'Notifications retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return next(notFoundError('Notification'));
    sendSuccess(res, notification, 'Marked as read');
  } catch (err) { next(err); }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notification) return next(notFoundError('Notification'));
    sendSuccess(res, null, 'Notification deleted');
  } catch (err) { next(err); }
};
