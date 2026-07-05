/**
 * Custom AppError class for operational errors.
 * Distinguishes between programmer errors and expected operational errors
 * so the global error handler can respond appropriately.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Mark as expected/handled error
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Common Error Factories ──────────────────────────────────────────────────

export const notFoundError = (resource = 'Resource') =>
  new AppError(`${resource} not found`, 404);

export const unauthorizedError = (msg = 'Unauthorized') =>
  new AppError(msg, 401);

export const forbiddenError = (msg = 'Forbidden') =>
  new AppError(msg, 403);

export const validationError = (msg = 'Validation failed') =>
  new AppError(msg, 422);

export const conflictError = (msg = 'Conflict') =>
  new AppError(msg, 409);
