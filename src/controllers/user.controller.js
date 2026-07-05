import User from '../models/user.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { notFoundError } from '../utils/AppError.js';
import { parsePagination, buildPagination } from '../utils/apiResponse.js';

export const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);
    sendSuccess(res, users, 'Users retrieved', 200, buildPagination(page, limit, total));
  } catch (err) { next(err); }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(notFoundError('User'));
    sendSuccess(res, user, 'User retrieved');
  } catch (err) { next(err); }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) return next(notFoundError('User'));
    sendSuccess(res, user, 'User role updated');
  } catch (err) { next(err); }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return next(notFoundError('User'));
    sendSuccess(res, user, 'User deactivated');
  } catch (err) { next(err); }
};
