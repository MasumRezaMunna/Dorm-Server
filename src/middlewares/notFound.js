import { AppError } from '../utils/AppError.js';

/**
 * 404 handler for unmatched routes.
 * Must be placed AFTER all route definitions, BEFORE the error handler.
 */
export const notFound = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};
