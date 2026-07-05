import jwt from 'jsonwebtoken';
import { AppError, unauthorizedError, forbiddenError } from '../utils/AppError.js';
import User from '../models/user.model.js';

/**
 * requireAuth middleware
 * Verifies the JWT from the Authorization header.
 * Attaches the full user document to req.user.
 */
export const requireAuth = async (req, _res, next) => {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(unauthorizedError('No authentication token provided'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (ensures deactivated users can't access)
    const user = await User.findById(decoded.id).select('-__v');
    if (!user) return next(unauthorizedError('User no longer exists'));
    if (!user.isActive) return next(forbiddenError('Your account has been deactivated'));

    req.user = user;
    next();
  } catch (err) {
    next(err); // JWT errors are caught by the global error handler
  }
};

/**
 * requireRole middleware factory
 * @param {...string} roles - Allowed roles (e.g., 'manager', 'member')
 */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(forbiddenError('You do not have permission to perform this action'));
  }
  next();
};

/**
 * Convenience shorthand for manager-only routes
 */
export const requireManager = [requireAuth, requireRole('manager')];

/**
 * Convenience shorthand for member + manager routes (any authenticated user)
 */
export const requireMember = [requireAuth, requireRole('member', 'manager')];
