/**
 * Standardized API response helpers
 * Ensures all responses follow the same envelope shape
 */

/**
 * Send a success response
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} message
 * @param {number} statusCode
 * @param {object} pagination
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, pagination = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 */
export const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Build a pagination metadata object
 * @param {number} page - current page (1-indexed)
 * @param {number} limit - items per page
 * @param {number} total - total document count
 */
export const buildPagination = (page, limit, total) => ({
  page: Number(page),
  limit: Number(limit),
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

/**
 * Parse query params for pagination
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
