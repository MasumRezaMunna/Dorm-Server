import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Global error handling middleware.
 * Must be the LAST middleware registered (4 params = error handler in Express).
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, isOperational } = err;

  // ─── Handle specific Mongoose/JWT errors ─────────────────────────────────

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    isOperational = true;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    statusCode = 409;
    message = `Duplicate value for field: ${field}`;
    isOperational = true;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
    isOperational = true;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
    isOperational = true;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
    isOperational = true;
  }

  // Log non-operational (programmer) errors
  if (!isOperational) {
    logger.error('UNHANDLED ERROR:', err);
  }

  // In production, don't leak stack traces for non-operational errors
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    message: isOperational ? message : 'Something went wrong. Please try again later.',
    ...(isDev && { stack: err.stack }),
  });
};
