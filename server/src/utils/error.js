/**
 * Creates a standardized application error object.
 *
 * Used as the base factory for custom HTTP errors.
 *
 * @param {Object} [params={}] - Error configuration.
 * @param {number} [params.statusCode=500] - HTTP status code.
 * @param {string} [params.error="Internal server error"] - Error type/title.
 * @param {string} [params.message] - Human-readable error message.
 * @param {*} [params.data] - Additional error details.
 *
 * @returns {Error} Error instance with custom HTTP error properties.
 */
const createError = ({
  statusCode = 500,
  error = "Internal server error",
  message,
  data,
} = {}) => {
  // Create native Error instance
  const err = new Error(message || "Internal server error");

  // Attach HTTP status code and error type
  err.statusCode = statusCode;
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
 * @param {Array<Object>} data - Validation error details.
 * @param {string} [message="invalid input"] - Error message.
 *
 * @returns {Error} Error with HTTP status code 400.
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
 * Used when authentication or access credentials are invalid.
 *
 * @param {string} [message="You don't have the right permission."] - Error message.
 *
 * @returns {Error} Error with HTTP status code 401.
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
 * Used when the authenticated user lacks the required permissions.
 *
 * @param {string} [message="Permission denied"] - Error message.
 *
 * @returns {Error} Error with HTTP status code 403.
 */
const forbidden = (message = "Permission denied") =>
  createError({
    statusCode: 403,
    error: "Forbidden",
    message,
  });

/**
 * Creates a 409 Conflict error.
 *
 * Used when a resource conflicts with an existing resource.
 *
 * @param {string} [message="Resource already exists"] - Error message.
 *
 * @returns {Error} Error with HTTP status code 409.
 */
const conflict = (message = "Resource already exists") =>
  createError({
    statusCode: 409,
    error: "Conflict",
    message,
  });

/**
 * Creates a 404 Not Found error.
 *
 * Used when a requested resource does not exist.
 *
 * @param {string} [message="Requested resource not found"] - Error message.
 *
 * @returns {Error} Error with HTTP status code 404.
 */
const notFound = (message = "Requested resource not found") =>
  createError({
    statusCode: 404,
    error: "Not found",
    message,
  });

/**
 * Creates a 500 Internal Server Error.
 *
 * Used for unexpected server-side failures.
 *
 * @param {string} [message="Internal server error"] - Error message.
 *
 * @returns {Error} Error with HTTP status code 500.
 */
const serverError = (message = "Internal server error") =>
  createError({
    statusCode: 500,
    error: "Internal server error",
    message,
  });

module.exports = {
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  notFound,
  serverError,
};
