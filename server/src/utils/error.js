/**
 * Creates a standardized application error object.
 *
 * Used as the base factory for all custom HTTP errors.
 *
 * @param {Object} [params={}] - Error configuration
 * @param {number} [params.statusCode] - HTTP status code
 * @param {string} [params.error] - Error type/title
 * @param {string} [params.message] - Human-readable error message
 * @param {*} [params.data] - Additional error details (validation errors, metadata, etc.)
 *
 * @returns {Error} Extended Error instance with custom properties
 */
const createError = ({
  statusCode = 500,
  error = "Internal server error",
  message,
  data,
} = {}) => {
  // Create native Error instance
  const err = new Error(message || "Internal server error");

  // Attach HTTP status code
  err.statusCode = statusCode;

  // Attach error type
  err.error = error;

  // Attach additional error data when provided
  if (data !== undefined) {
    err.data = data;
  }

  return err;
};

/**
 * Creates a 400 Bad Request error.
 *
 * Commonly used for request validation failures.
 *
 * @param {Array<Object>} data - Validation error details
 * @param {string} message - Error message
 *
 * @returns {Error}
 */
const badRequest = (data, message = "invalid input") =>
  createError({
    statusCode: 400,
    error: "Bad request",
    message,
    data,
  });

/**
 * Creates a 401 Unauthorized error.
 *
 * Used when authentication fails or credentials are invalid.
 *
 * @param {string} message - Error message
 *
 * @returns {Error}
 */
const unauthorized = (message = "You don't have the right permission.") =>
  createError({
    statusCode: 401,
    error: "Unauthorized",
    message,
  });

/**
 * Creates a 403 Forbidden error.
 *
 * Used when the authenticated user lacks required permissions.
 *
 * @param {string} message - Error message
 *
 * @returns {Error}
 */
const forbidden = (message = "Permission denied") =>
  createError({
    statusCode: 403,
    error: "Forbidden",
    message,
  });

/**
 * Creates a 404 Not Found error.
 *
 * Used when a requested resource does not exist.
 *
 * @param {string} message - Error message
 *
 * @returns {Error}
 */
const notFound = (message = "Requested resource not found") =>
  createError({
    statusCode: 404,
    error: "Not found",
    message,
  });

module.exports = {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
};
